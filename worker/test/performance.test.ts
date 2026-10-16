import { describe, expect, it } from "vitest";
import { addDays, effectiveSettings, type DayPoint, type MergedWorkout, type SleepRow, type WorkoutLoad, type WorkoutRow } from "../src/core/analysis";
import {
  estimateFtp,
  flattenCurves,
  formZone,
  healthBand,
  hrZones,
  periodKey,
  periodSummaries,
  powerCurve,
  powerZones,
  sleepTiming,
  trainingLoadReport,
  zoneDistribution,
  zoneOf,
} from "../src/core/performance";
import { pearson, strainRecovery } from "../src/core/insights";
import { analysisContext, fitnessProfileView, healthTrendsView, periodSummariesView, strainRecoveryView, trainingLoadView } from "../src/core/analytics";
import { runBatched, upsertDaily, upsertSleep, upsertWorkout, upsertWorkoutStream, updateRecovery } from "../src/core/repository";
import { writeSettings } from "../src/core/settings";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch, keine echten Messwerte.

const workout = (o: Partial<WorkoutRow>): WorkoutRow => ({
  day: "2026-03-02", source: "wahoo", source_id: "w1", start_time: "2026-03-02T16:00:00.000Z", end_time: "2026-03-02T17:00:00.000Z",
  sport: "cycling", duration_s: 3600, distance_m: null, energy_kj: null, avg_hr: null, max_hr: null, avg_power_w: null,
  normalized_power_w: null, strain: null, ...o,
});

const loaded = (o: Partial<WorkoutRow & WorkoutLoad>): MergedWorkout & WorkoutLoad => ({
  ...workout(o), sources: [o.source ?? "wahoo"], load: null, method: "none", intensity: null, ...o,
});

const point = (day: string, o: Partial<DayPoint> = {}): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0, ...o,
});

/** Tagesreihe von `from` über `n` Tage, Werte je Index. */
const days = (from: string, n: number, f: (i: number) => Partial<DayPoint>) => Array.from({ length: n }, (_, i) => point(addDays(from, i), f(i)));

describe("Leistungskurve", () => {
  it("zerlegt die Kurven je Workout", () => {
    expect(flattenCurves([{ day: "2026-03-01", source: "mywhoosh", source_id: "a", power_curve: { "5": 800, "1200": 260 } }])).toEqual([
      { source: "mywhoosh", source_id: "a", day: "2026-03-01", duration_s: 5, watts: 800 },
      { source: "mywhoosh", source_id: "a", day: "2026-03-01", duration_s: 1200, watts: 260 },
    ]);
  });

  it("nimmt je Dauer den besten Wert im Zeitraum", () => {
    const rows = [
      { source: "mywhoosh", source_id: "a", day: "2026-01-10", duration_s: 1200, watts: 280 },
      { source: "wahoo", source_id: "b", day: "2026-03-01", duration_s: 1200, watts: 260 },
      { source: "wahoo", source_id: "b", day: "2026-03-01", duration_s: 60, watts: 450 },
    ];
    expect(powerCurve(rows)).toEqual([
      { durationS: 60, watts: 450, day: "2026-03-01", source: "wahoo" },
      { durationS: 1200, watts: 280, day: "2026-01-10", source: "mywhoosh" },
    ]);
    expect(powerCurve(rows, "2026-02-01").find((p) => p.durationS === 1200)?.watts).toBe(260);
  });
});

describe("FTP-Schätzung", () => {
  it("95 % der besten 20 Minuten, sonst beste Stunde", () => {
    const curve = [{ durationS: 1200, watts: 300, day: "2026-03-01", source: "wahoo" }, { durationS: 3600, watts: 270, day: "2026-03-02", source: "wahoo" }];
    expect(estimateFtp(curve, [], "2026-01-01")).toMatchObject({ watts: 285, method: "curve_20min", confidence: "medium" });
    curve[1].watts = 290;
    expect(estimateFtp(curve, [], "2026-01-01")).toMatchObject({ watts: 290, method: "curve_60min" });
  });

  it("ohne Kurve grob aus normalisierter Leistung längerer Fahrten", () => {
    const ws = [
      workout({ normalized_power_w: 230, duration_s: 7200 }),
      workout({ source_id: "w2", normalized_power_w: 260, duration_s: 1200 }),
      workout({ source_id: "w3", normalized_power_w: 400, duration_s: 600 }), // zu kurz
      workout({ source_id: "w4", day: "2025-01-01", normalized_power_w: 350, duration_s: 3600 }), // zu alt
    ];
    expect(estimateFtp([], ws, "2026-01-01")).toMatchObject({ watts: 247, method: "workouts_np", confidence: "low", basedOn: { watts: 260 } });
    expect(estimateFtp([], [workout({ avg_hr: 140 })], "2026-01-01")).toBeNull();
  });

  it("eigene FTP geht vor, Schätzung gilt nur ohne", () => {
    expect(effectiveSettings({}, [], [], null, 250)).toMatchObject({ ftpW: 250, origin: { ftpW: "data" } });
    expect(effectiveSettings({ ftpW: 270 }, [], [], null, 250)).toMatchObject({ ftpW: 270, origin: { ftpW: "user" } });
    expect(effectiveSettings({}, [], [], null)).toMatchObject({ ftpW: null, origin: { ftpW: "none" } });
  });
});

describe("Zonen", () => {
  it("Leistungszonen nach Coggan, lückenlos", () => {
    const z = powerZones(200);
    expect(z).toHaveLength(7);
    expect(z[0]).toMatchObject({ min: 0, max: 110 });
    expect(z[1]).toMatchObject({ min: 111, max: 150 });
    expect(z[3]).toMatchObject({ name: "Schwelle", min: 181, max: 210 });
    expect(z[6].max).toBeNull();
    expect(zoneOf(200, z)).toBe(4);
    expect(zoneOf(1000, z)).toBe(7);
  });

  it("Pulszonen nach Friel", () => {
    const z = hrZones(170);
    expect(z.map((x) => x.max)).toEqual([138, 151, 158, 168, null]);
    expect(zoneOf(150, z)).toBe(2);
  });

  it("verteilt Zeit nach mittlerer Intensität (Näherung)", () => {
    const zones = hrZones(170);
    const d = zoneDistribution(
      [workout({ avg_hr: 125, duration_s: 4 * 3600 }), workout({ avg_hr: 165, duration_s: 3600 }), workout({ avg_hr: null })],
      zones,
      "hr",
    );
    expect(d.totalMinutes).toBe(300);
    expect(d.zones[0]).toMatchObject({ minutes: 240, sharePct: 80, workouts: 1 });
    expect(d.intensity).toEqual({ easyPct: 80, moderatePct: 0, hardPct: 20 });
  });
});

describe("Form und Trainingslast", () => {
  it("ordnet die Form ein", () => {
    expect([-40, -20, 0, 10, 30].map(formZone)).toEqual(["overreaching", "productive", "maintaining", "fresh", "detraining"]);
  });

  it("aktueller Stand, Anstieg und Top-Workouts", () => {
    const series = days("2026-03-01", 14, (i) => ({ load: i % 2 ? 0 : 80, ctl: 30 + i, atl: 40 + i, tsb: -12 }));
    const ws = [loaded({ day: "2026-03-13", load: 120, method: "power" }), loaded({ day: "2026-03-05", source_id: "x", load: 50, method: "hr" })];
    const r = trainingLoadReport(series, ws, "2026-03-14", "2026-03-08");
    expect(r.current).toMatchObject({ day: "2026-03-14", ctl: 43, rampRate7d: 7, acwr: 1.23, formZone: "productive", load7d: 240 });
    expect(r.days).toHaveLength(7);
    expect(r.methods).toEqual({ power: 1, hr: 0, none: 0 });
    expect(r.topWorkouts.map((w) => w.load)).toEqual([120]);
    expect(r.monotony7d).toBeCloseTo(0.8, 1);
  });
});

describe("Zeiträume", () => {
  it("Schlüssel für Woche, Monat, Jahr", () => {
    expect(periodKey("2026-03-04", "week")).toBe("2026-03-02");
    expect(periodKey("2026-03-04", "month")).toBe("2026-03");
    expect(periodKey("2026-03-04", "year")).toBe("2026");
  });

  it("fasst Monate zusammen und vergleicht mit dem Vormonat", () => {
    const series = days("2026-02-01", 59, (i) => ({
      load: i < 28 ? 50 : 75,
      ctl: i,
      recovery: i % 3 === 0 ? 80 : i % 3 === 1 ? 50 : 20,
      sleepH: 7,
    }));
    const ws = [loaded({ day: "2026-02-03", distance_m: 30_000, duration_s: 3600 }), loaded({ day: "2026-03-10", source_id: "b", sport: null, duration_s: 1800 })];
    const [feb, mar] = periodSummaries(series, ws, "month", 8);
    expect(feb).toMatchObject({ period: "2026-02", days: 28, workouts: 1, distanceKm: 30, load: 1400, avgDailyLoad: 50, sleepDebtH: 28, loadChangePct: null });
    expect(feb.recoveryDays.green + feb.recoveryDays.yellow + feb.recoveryDays.red).toBe(28);
    expect(mar).toMatchObject({ period: "2026-03", days: 31, loadChangePct: 50, ctlStart: 27, ctlEnd: 58, ctlChange: 31 });
    expect(mar.bySport).toEqual({ andere: { count: 1, minutes: 30, distanceKm: 0 } });
  });
});

describe("Strain gegen Erholung", () => {
  it("erkennt einen eingebauten Zusammenhang", () => {
    // Hoher Strain (16) an jedem dritten Tag → Erholung am Folgetag 40 statt 75.
    const series = days("2026-01-01", 60, (i) => ({ strain: i % 3 === 0 ? 16 : 8, load: i % 3 === 0 ? 120 : 20, recovery: (i - 1) % 3 === 0 ? 40 : 75, hrv: 60 }));
    const r = strainRecovery(series, "2026-03-01", "2026-01-01");
    expect(r.correlation.n).toBe(59);
    expect(r.correlation.strainToNextRecovery!).toBeLessThan(-0.9);
    expect(r.byStrain.find((b) => b.key === "light")?.avgNextRecovery).toBe(75);
    expect(r.byStrain.find((b) => b.key === "high")?.avgNextRecovery).toBe(40);
    expect(r.byLoad.find((b) => b.key === "hard")?.days).toBeGreaterThan(15);
    expect(r.insights[0]).toContain("35 Punkte niedriger");
  });

  it("meldet zu wenig Daten", () => {
    const r = strainRecovery(days("2026-01-01", 5, () => ({ strain: 10, recovery: 60 })), "2026-01-05", "2026-01-01");
    expect(r.insights.at(-1)).toContain("Erst 4 Tagespaare");
  });

  it("Korrelation", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });
});

describe("Gesundheitstrends", () => {
  it("Normalbereich aus den 28 Tagen vor der letzten Woche", () => {
    const series = days("2026-01-01", 42, (i) => ({ hrv: i < 35 ? (i % 2 ? 50 : 60) : 40 }));
    const band = healthBand(series, "hrv", "2026-02-11", "2026-02-11");
    expect(band[0]).toMatchObject({ value: 40, avg7: 40, baseline: 55 });
    expect(band[0].low!).toBeLessThan(55);
    expect(band[0].high!).toBeGreaterThan(55);
  });

  it("Schlafrhythmus über Mitternacht", () => {
    const sleep = (day: string, start: string, end: string, h: number): SleepRow => ({
      day, source: "whoop", start_time: start, end_time: end, is_nap: 0, in_bed_s: null, asleep_s: h * 3600, awake_s: null,
      light_s: null, deep_s: null, rem_s: null, performance_pct: null, efficiency_pct: null, consistency_pct: null, respiratory_rate: null,
    });
    // Berlin im Januar = UTC+1: 22:30 und 00:30 lokal → Mittel 23:30.
    const t = sleepTiming(
      [sleep("2026-01-10", "2026-01-09T21:30:00Z", "2026-01-10T05:30:00Z", 7), sleep("2026-01-11", "2026-01-10T23:30:00Z", "2026-01-11T06:30:00Z", 6)],
      "Europe/Berlin",
      "2026-01-01",
      "2026-01-11",
      8,
    );
    expect(t).toMatchObject({ nights: 2, avgBedtime: "23:30", avgWake: "07:00", debt7dH: 3 });
    expect(t.bedtimeSdMin).toBe(85);
  });
});

describe("Werkzeuge gegen D1", () => {
  it("rechnet aus gespeicherten Daten, FTP aus der Leistungskurve", async () => {
    const db = fakeD1();
    const now = Date.parse("2026-03-31T10:00:00Z");
    const stmts: D1PreparedStatement[] = [];
    for (let i = 0; i < 60; i++) {
      const day = addDays("2026-02-01", i);
      stmts.push(upsertDaily(db, { source: "whoop", sourceId: `c${i}`, day, startTime: `${day}T05:00:00.000Z`, endTime: null, strain: i % 2 ? 15 : 8, energyKj: 9000, avgHr: 65, maxHr: 185 }));
      stmts.push(updateRecovery(db, { source: "whoop", dailySourceId: `c${i}`, recoveryScore: i % 2 ? 70 : 45, restingHr: 52, hrvMs: 60 + (i % 5), spo2Pct: 97, skinTempC: 33.5 }));
      stmts.push(upsertSleep(db, { source: "whoop", sourceId: `s${i}`, day, startTime: `${addDays(day, -1)}T22:00:00.000Z`, endTime: `${day}T05:30:00.000Z`, isNap: false, inBedS: 27000, asleepS: 25200, awakeS: 1800, lightS: null, deepS: null, remS: null, performancePct: 85, efficiencyPct: 92, consistencyPct: null, respiratoryRate: 14.5 }));
      if (i % 2 === 0)
        stmts.push(upsertWorkout(db, { source: "wahoo", sourceId: `r${i}`, day, startTime: `${day}T16:00:00.000Z`, endTime: `${day}T17:30:00.000Z`, sport: "cycling", durationS: 5400, distanceM: 45000, energyKj: 1000, avgHr: 140, maxHr: 170, avgPowerW: 200, normalizedPowerW: 215, strain: null }));
    }
    // Eine importierte FIT-Fahrt mit Bestleistungskurve (wie vom MyWhoosh-Import gespeichert).
    stmts.push(upsertWorkout(db, { source: "mywhoosh", sourceId: "fit1", day: "2026-03-20", startTime: "2026-03-20T07:00:00.000Z", endTime: "2026-03-20T07:30:00.000Z", sport: "cycling", durationS: 1800, distanceM: 15000, energyKj: 450, avgHr: null, maxHr: null, avgPowerW: 240, normalizedPowerW: 255, strain: null }));
    stmts.push(upsertWorkoutStream(db, { source: "mywhoosh", sourceId: "fit1", startTime: "2026-03-20T07:00:00.000Z", power: null, heartRate: null, cadence: null, powerCurve: { "300": 330, "1200": 280 } }));
    await runBatched(db, stmts);

    const c = await analysisContext(db, { days: 28, now });
    expect(c.today).toBe("2026-03-31");
    expect(c.settings).toMatchObject({ ftpW: 266, origin: { ftpW: "data" } });

    const profile = fitnessProfileView(c);
    expect(profile.ftp).toMatchObject({ watts: 266, origin: "data", estimate: { method: "curve_20min" } });
    expect(profile.zones.power).toHaveLength(7);
    expect(profile.zoneDistribution.power?.totalMinutes).toBe(14 * 90 + 30);
    expect(profile.powerCurve.allTime.map((p) => p.durationS)).toEqual([300, 1200]);

    const load = trainingLoadView(c);
    expect(load.days).toHaveLength(28);
    expect(load.methods.power).toBe(15);
    expect(load.current!.ctl).toBeGreaterThan(20);

    const health = healthTrendsView(c);
    expect(health.metrics.hrv.band).toHaveLength(28);
    expect(health.metrics.rhr).toMatchObject({ last: 52, status: "normal" });
    expect(health.sleep.last14d.nights).toBe(14);

    const months = periodSummariesView(c, "month");
    expect(months.periods.map((p) => p.period)).toEqual(["2026-03"]);

    const sr = strainRecoveryView(c);
    expect(sr.correlation.n).toBe(27);
    expect(sr.byStrain.find((b) => b.key === "high")?.avgNextRecovery).toBe(45);

    await writeSettings(db, { ftpW: 300 });
    const own = await analysisContext(db, { days: 28, now });
    expect(own.settings).toMatchObject({ ftpW: 300, origin: { ftpW: "user" } });
  });
});
