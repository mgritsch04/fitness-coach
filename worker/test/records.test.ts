import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import type { PowerBestRow } from "../src/core/performance";
import { recordEvents, recordsReport, weekCompare } from "../src/core/records";
import type { StrengthSession } from "../src/core/strength";

// Synthetische Werte, keine echten Messwerte.

const pw = (day: string, duration_s: number, watts: number): PowerBestRow => ({ source: "mywhoosh", source_id: day, day, duration_s, watts });
const ride = (day: string, km: number, min: number, sport = "cycling") => ({ day, sport, distance_m: km * 1000, duration_s: min * 60 });
const sess = (day: string, weightKg: number, reps: number): StrengthSession => ({
  id: day, day, startTime: null, durationMin: 60, rpe: 7, name: null, notes: null, linkedSource: null, linkedSourceId: null,
  sets: [{ exercise: "squat", exerciseName: "Kniebeuge", reps, weightKg }],
});

describe("Rekorde", () => {
  const power = [pw("2026-03-01", 300, 250), pw("2026-03-05", 300, 245), pw("2026-03-10", 300, 262), pw("2026-03-10", 300, 258), pw("2026-03-10", 60, 400)];
  const rides = [ride("2026-03-01", 40, 90), ride("2026-03-08", 40.3, 100), ride("2026-03-15", 62, 150), ride("2026-03-16", 10, 30, "bodybuilding")];
  const strength = [sess("2026-03-02", 100, 5), sess("2026-03-09", 100, 5), sess("2026-03-12", 102.5, 5), sess("2026-03-14", 100, 6)];
  const ev = recordEvents(power, rides, strength);

  it("Leistung: nur Verbesserungen gegen den bisherigen Bestwert, erster Wert zählt nicht", () => {
    const p = ev.filter((e) => e.kind === "power");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ day: "2026-03-10", key: "300", value: 262, previous: 250, previousDay: "2026-03-01", delta: 12, text: "Neue 5-min-Bestleistung: 262 W (+12 W)" });
  });

  it("Kraft: geschätztes 1RM, unter 1 % zählt nicht", () => {
    const s = ev.filter((e) => e.kind === "strength");
    // 100×5 → 116,7; 102,5×5 → 119,6 (+2,5 %); 100×6 → 120 (+0,3 %, zählt nicht)
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ day: "2026-03-12", value: 119.6, previous: 116.7, unit: "kg" });
  });

  it("Längste Fahrt nach Strecke und Zeit, nur Radeinheiten, mit Mindestabstand", () => {
    expect(ev.filter((e) => e.kind === "distance").map((e) => [e.day, e.value, e.previous])).toEqual([["2026-03-15", 62, 40.3]]);
    expect(ev.filter((e) => e.kind === "duration").map((e) => [e.day, e.value])).toEqual([["2026-03-15", 150], ["2026-03-08", 100]]);
    expect(ev[0].day).toBe("2026-03-15");
  });

  it("Feed nach Zeitraum", () => {
    const r = recordsReport({ powerRows: power, workouts: rides, strength, series: [] }, "2026-03-16", 7);
    expect(r.records.every((e) => e.day >= "2026-03-10")).toBe(true);
    expect(r.records).toHaveLength(4);
    expect(r.totalRecords).toBe(5);
  });
});

describe("Wochenvergleich", () => {
  const p = (day: string, o: Partial<DayPoint>): DayPoint => ({
    day, recovery: 60, hrv: 50, rhr: 50, spo2: null, skinTemp: null, strain: 10, sleepH: 7, sleepPerf: null, sleepEff: null, deepH: null, remH: null, respRate: null,
    load: 50, ctl: 0, atl: 0, tsb: 0, workouts: 1, trainingMin: 60, ...o,
  });
  // Mittwoch, 2026-03-18: diese Woche Mo–Mi, Vorwoche Mo–So.
  const series = Array.from({ length: 10 }, (_, i) => {
    const day = addDays("2026-03-09", i);
    return day >= "2026-03-16" ? p(day, { load: 80, trainingMin: 90, recovery: 70, sleepH: 7.5 }) : p(day, {});
  });
  const w = weekCompare(series, "2026-03-18");

  it("gleiche Wochentage und ganze Vorwoche", () => {
    expect(w.thisWeek).toMatchObject({ from: "2026-03-16", to: "2026-03-18", days: 3, workouts: 3, trainingH: 4.5, load: 240, avgRecovery: 70 });
    expect(w.lastWeekSamePeriod).toMatchObject({ from: "2026-03-09", to: "2026-03-11", days: 3, trainingH: 3, load: 150 });
    expect(w.lastWeekFull).toMatchObject({ days: 7, trainingH: 7, load: 350 });
    expect(w.change).toEqual({ trainingH: 1.5, load: 90, workouts: 0, avgRecovery: 10, avgHrv: 0, avgSleepH: 0.5 });
  });
});

describe("recordsView", () => {
  it("läuft gegen das echte Schema (leere Datenbank)", async () => {
    const { fakeD1 } = await import("./fake-d1");
    const { analysisContext, recordsView } = await import("../src/core/analytics");
    const db = fakeD1();
    const r = await recordsView(db, await analysisContext(db, { days: 14 }), 30);
    expect(r.records).toEqual([]);
    expect(r.week.thisWeek.workouts).toBe(0);
  });
});
