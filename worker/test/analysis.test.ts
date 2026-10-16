import { describe, expect, it } from "vitest";
import {
  addDays,
  daySeries,
  effectiveSettings,
  mergeWorkouts,
  todayIn,
  trainingLoad,
  trend,
  weekStart,
  weeklySummaries,
  workoutLoad,
  type DailyRow,
  type DayPoint,
  type SleepRow,
  type WorkoutRow,
} from "../src/core/analysis";
import { coachAdvice } from "../src/core/coach";
import { buildDashboard } from "../src/core/dashboard";
import { runBatched, upsertDaily, upsertSleep, upsertWorkout, updateRecovery } from "../src/core/repository";
import { readSettings, writeSettings } from "../src/core/settings";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch, keine echten Messwerte.

const workout = (o: Partial<WorkoutRow>): WorkoutRow => ({
  day: "2026-03-02",
  source: "whoop",
  source_id: "w1",
  start_time: "2026-03-02T16:00:00.000Z",
  end_time: "2026-03-02T17:00:00.000Z",
  sport: "cycling",
  duration_s: 3600,
  distance_m: null,
  energy_kj: null,
  avg_hr: null,
  max_hr: null,
  avg_power_w: null,
  normalized_power_w: null,
  strain: null,
  ...o,
});

const point = (day: string, o: Partial<DayPoint> = {}): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0, ...o,
});

describe("Datum", () => {
  it("rechnet Tage und Wochen", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(weekStart("2026-03-04")).toBe("2026-03-02"); // Mittwoch → Montag
    expect(weekStart("2026-03-08")).toBe("2026-03-02"); // Sonntag → Montag davor
    expect(todayIn("Europe/Berlin", Date.parse("2026-03-01T23:30:00Z"))).toBe("2026-03-02");
  });
});

describe("Duplikat-Abgleich", () => {
  it("führt dieselbe Fahrt aus Wahoo und WHOOP zusammen, Wahoo ist Hauptquelle", () => {
    const merged = mergeWorkouts([
      workout({ source: "whoop", source_id: "a", avg_hr: 140, max_hr: 175, strain: 12 }),
      workout({ source: "wahoo", source_id: "b", start_time: "2026-03-02T16:03:00.000Z", avg_power_w: 200, normalized_power_w: 215, max_hr: 170 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ source: "wahoo", sources: ["wahoo", "whoop"], avg_hr: 140, max_hr: 175, strain: 12, normalized_power_w: 215 });
  });

  it("lässt verschiedene Einheiten am selben Tag getrennt", () => {
    const merged = mergeWorkouts([
      workout({ source: "whoop", source_id: "a", start_time: "2026-03-02T06:00:00.000Z", end_time: "2026-03-02T06:45:00.000Z" }),
      workout({ source: "wahoo", source_id: "b" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("verschmilzt nie zwei Einheiten derselben Quelle", () => {
    expect(mergeWorkouts([workout({ source_id: "a" }), workout({ source_id: "b" })])).toHaveLength(2);
  });
});

describe("Belastung je Workout", () => {
  const s = { ftpW: 250, maxHr: 190, restingHr: 50, thresholdHr: null };

  it("Leistung: 1 h an der FTP = 100, 2 h bei 80 % = 128", () => {
    expect(workoutLoad(workout({ normalized_power_w: 250 }), s)).toEqual({ load: 100, method: "power", intensity: 1 });
    expect(workoutLoad(workout({ duration_s: 7200, normalized_power_w: 200 }), s).load).toBe(128);
  });

  it("Puls: 1 h an der geschätzten Schwelle (85 % HFR) = 100", () => {
    const r = workoutLoad(workout({ avg_hr: 169 }), { ...s, ftpW: null });
    expect(r.method).toBe("hr");
    expect(r.load).toBe(100);
    // Lockerer: deutlich weniger.
    expect(workoutLoad(workout({ avg_hr: 120 }), { ...s, ftpW: null }).load!).toBeLessThan(50);
  });

  it("ohne Puls und Leistung keine Schätzung", () => {
    expect(workoutLoad(workout({}), s)).toEqual({ load: null, method: "none", intensity: null });
  });
});

describe("Trainingslast", () => {
  it("CTL/ATL nach Handrechnung, TSB aus dem Vortag", () => {
    const pts = trainingLoad(new Map([["2026-03-01", 100]]), "2026-03-01", "2026-03-02");
    expect(pts[0]).toEqual({ day: "2026-03-01", load: 100, ctl: 2.4, atl: 14.3, tsb: 0 });
    expect(pts[1]).toMatchObject({ load: 0, tsb: -11.9 });
  });

  it("konstante Belastung nähert sich dem Tageswert", () => {
    const loads = new Map<string, number>();
    for (let i = 0; i < 300; i++) loads.set(addDays("2026-01-01", i), 50);
    const last = trainingLoad(loads, "2026-01-01", addDays("2026-01-01", 299)).at(-1)!;
    expect(last.ctl).toBeCloseTo(50, 0);
    expect(last.atl).toBeCloseTo(50, 0);
  });
});

describe("Einstellungen", () => {
  it("schätzt fehlende Werte aus den Daten", () => {
    const daily = [{ day: "2026-03-01", resting_hr: 50, max_hr: 160 }, { day: "2026-03-02", resting_hr: 54, max_hr: 150 }] as DailyRow[];
    const e = effectiveSettings({}, daily, [workout({ max_hr: 185 })], 180);
    expect(e).toMatchObject({ maxHr: 185, restingHr: 52, thresholdHr: Math.round(52 + 0.85 * 133), ftpW: null, sleepNeedH: 8 });
    expect(e.origin).toMatchObject({ maxHr: "data", restingHr: "data", thresholdHr: "default", ftpW: "none" });
  });

  it("gesetzte Werte haben Vorrang", () => {
    const e = effectiveSettings({ maxHr: 195, ftpW: 260, sleepNeedH: 7.5 }, [], [], 180);
    expect(e).toMatchObject({ maxHr: 195, ftpW: 260, sleepNeedH: 7.5 });
    expect(e.origin.maxHr).toBe("user");
  });

  it("werden in D1 gespeichert und mit null gelöscht", async () => {
    const db = fakeD1();
    await writeSettings(db, { ftpW: 250, timezone: "Europe/Vienna" });
    expect(await readSettings(db)).toEqual({ ftpW: 250, timezone: "Europe/Vienna" });
    await writeSettings(db, { ftpW: null });
    expect(await readSettings(db)).toEqual({ timezone: "Europe/Vienna" });
  });
});

describe("Trends", () => {
  it("erkennt eine gesunkene HRV gegenüber der Basis", () => {
    const series: DayPoint[] = [];
    for (let i = 0; i < 35; i++) series.push(point(addDays("2026-03-01", i), { hrv: i < 28 ? 60 + (i % 3) : 48 }));
    const t = trend(series, "hrv", addDays("2026-03-01", 34));
    expect(t.status).toBe("below");
    expect(t.avg7).toBe(48);
    expect(t.baseline).toBeCloseTo(61, 0);
    expect(t.deltaPct).toBeLessThan(-15);
  });

  it("zu wenig Basis-Daten: unbekannt", () => {
    expect(trend([point("2026-03-01", { hrv: 50 })], "hrv", "2026-03-01").status).toBe("unknown");
  });
});

describe("Tagesreihe und Wochen", () => {
  it("nimmt den längsten Hauptschlaf und fasst Wochen zusammen", () => {
    const sleeps = [
      { day: "2026-03-02", is_nap: 0, asleep_s: 7 * 3600, start_time: "", end_time: "" },
      { day: "2026-03-02", is_nap: 1, asleep_s: 1800, start_time: "", end_time: "" },
      { day: "2026-03-03", is_nap: 0, asleep_s: 6 * 3600, start_time: "", end_time: "" },
    ] as SleepRow[];
    const ws = mergeWorkouts([workout({ avg_hr: 169, distance_m: 30000 })]).map((w) => ({ ...w, ...workoutLoad(w, { ftpW: null, maxHr: 190, restingHr: 50, thresholdHr: null }) }));
    const load = trainingLoad(new Map([["2026-03-02", 100]]), "2026-03-02", "2026-03-03");
    const series = daySeries([], sleeps, ws, load, "2026-03-02", "2026-03-03");
    expect(series[0]).toMatchObject({ sleepH: 7, load: 100, workouts: 1, trainingMin: 60 });
    const weeks = weeklySummaries(series, ws, 8);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ week: "2026-03-02", workouts: 1, trainingH: 1, load: 100, distanceKm: 30, avgSleepH: 6.5, sleepDebtH: 3 });
    expect(weeks[0].bySport).toEqual({ cycling: { count: 1, minutes: 60 } });
  });
});

describe("Coach", () => {
  const trends = (o: Partial<Record<"hrv" | "rhr" | "recovery" | "sleepH", { status: string; deltaPct?: number; baseline?: number }>> = {}) => {
    const t = { last: null, lastDay: null, avg7: null, baseline: null, baselineSd: null, deltaPct: null, status: "normal" as const };
    return {
      hrv: { ...t, ...o.hrv }, rhr: { ...t, ...o.rhr }, recovery: { ...t, ...o.recovery }, sleepH: { ...t, ...o.sleepH },
    } as Parameters<typeof coachAdvice>[2];
  };

  it("grüne Erholung, guter Schlaf → harte Einheit möglich", () => {
    const a = coachAdvice([point("2026-03-10", { recovery: 85, sleepH: 8, ctl: 50, tsb: 5 })], "2026-03-10", trends({ hrv: { status: "above", deltaPct: 8 } }), 8);
    expect(a.readiness).toBe("hard");
    expect(a.targetLoad!.min).toBeGreaterThanOrEqual(65);
    expect(a.reasons.map((r) => r.factor)).toEqual(expect.arrayContaining(["recovery", "hrv", "sleep"]));
  });

  it("rote Erholung → höchstens locker, auch bei sonst guten Werten", () => {
    const a = coachAdvice([point("2026-03-10", { recovery: 25, sleepH: 8.5, ctl: 50, tsb: 20 })], "2026-03-10", trends({ hrv: { status: "above", deltaPct: 10 } }), 8);
    expect(["rest", "easy"]).toContain(a.readiness);
  });

  it("schlechte Werte zusammen → Ruhe, Warnung bei schnellem Anstieg", () => {
    const series = [point("2026-03-03", { ctl: 30 }), point("2026-03-10", { recovery: 30, sleepH: 5, ctl: 45, tsb: -35, rhr: 60 })];
    const a = coachAdvice(series, "2026-03-10", trends({ hrv: { status: "below", deltaPct: -15 }, rhr: { status: "above", baseline: 50 } }), 8);
    expect(a.readiness).toBe("rest");
    expect(a.warnings[0]).toMatch(/Trainingslast steigt schnell/);
    expect(a.disclaimer).toMatch(/keine medizinische Diagnose/);
  });
});

describe("Dashboard aus D1", () => {
  it("liefert Tagesreihe, Wochen, Workouts und Empfehlung", async () => {
    const db = fakeD1();
    const now = Date.parse("2026-03-20T10:00:00Z");
    const stmts = [];
    for (let i = 0; i < 50; i++) {
      const day = addDays("2026-01-30", i);
      stmts.push(upsertDaily(db, { source: "whoop", sourceId: `c${i}`, day, startTime: `${day}T05:00:00.000Z`, endTime: null, strain: 10, energyKj: 9000, avgHr: 65, maxHr: 170 }));
      stmts.push(updateRecovery(db, { source: "whoop", dailySourceId: `c${i}`, recoveryScore: 70, restingHr: 50, hrvMs: 60, spo2Pct: 96, skinTempC: 33 }));
      stmts.push(upsertSleep(db, {
        source: "whoop", sourceId: `s${i}`, day, startTime: `${addDays(day, -1)}T22:00:00.000Z`, endTime: `${day}T05:30:00.000Z`, isNap: false,
        inBedS: 27000, asleepS: 25200, awakeS: 1800, lightS: 12600, deepS: 6300, remS: 6300, performancePct: 90, efficiencyPct: 93, consistencyPct: 80, respiratoryRate: 15,
      }));
      if (i % 2 === 0) {
        const start = `${day}T16:00:00.000Z`;
        stmts.push(upsertWorkout(db, {
          source: "whoop", sourceId: `w${i}`, day, startTime: start, endTime: `${day}T17:00:00.000Z`, sport: "cycling", durationS: 3600,
          distanceM: null, energyKj: 2500, avgHr: 150, maxHr: 175, avgPowerW: null, normalizedPowerW: null, strain: 12,
        }));
        stmts.push(upsertWorkout(db, {
          source: "wahoo", sourceId: `x${i}`, day, startTime: `${day}T16:02:00.000Z`, endTime: `${day}T17:00:00.000Z`, sport: "cycling", durationS: 3480,
          distanceM: 30000, energyKj: 2400, avgHr: 149, maxHr: null, avgPowerW: 190, normalizedPowerW: 205, strain: null,
        }));
      }
    }
    await runBatched(db, stmts);
    const d = await buildDashboard(db, { days: 14, now });
    expect(d.today).toBe("2026-03-20");
    expect(d.days).toHaveLength(14);
    expect(d.workouts.every((w) => w.sources.length === 2 && w.sources[0] === "wahoo")).toBe(true);
    // Ohne eigene FTP wird sie aus der Leistung der Fahrten geschätzt (performance.ts).
    expect(d.settings.origin.ftpW).toBe("data");
    expect(d.ftpEstimate).toMatchObject({ method: "workouts_np", confidence: "low" });
    expect(d.workouts[0].loadMethod).toBe("power");
    expect(d.notes.join(" ")).toMatch(/ist geschätzt/);
    expect(d.days.at(-1)!.ctl).toBeGreaterThan(0);
    expect(d.trends.hrv.status).toBe("normal");
    expect(d.coach.reasons.length).toBeGreaterThan(0);
    expect(d.weeks.length).toBeGreaterThanOrEqual(2);

    await writeSettings(db, { ftpW: 250 });
    const withFtp = await buildDashboard(db, { days: 14, now });
    expect(withFtp.workouts[0].loadMethod).toBe("power");
    expect(withFtp.settings.origin.ftpW).toBe("user");
    expect(withFtp.notes.join(" ")).not.toMatch(/Ohne FTP/);
  });
});
