import { describe, expect, it } from "vitest";
import { addDays, type DayPoint, type MergedWorkout, type WorkoutLoad } from "../src/core/analysis";
import { slotOf, timingReport } from "../src/core/timing";

// Synthetische Wochen, keine echten Messwerte. Zeiten in UTC (Zeitzone UTC im Test).
const TODAY = "2026-04-30";
type W = MergedWorkout & WorkoutLoad;
const ride = (day: string, hour: number, ef: number): W => ({
  day, source: "mywhoosh", source_id: `${day}-${hour}`, start_time: `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`,
  end_time: `${day}T${String(hour + 1).padStart(2, "0")}:00:00.000Z`, sport: "cycling", duration_s: 3600, distance_m: 30000,
  energy_kj: null, avg_hr: 140, max_hr: null, avg_power_w: null, normalized_power_w: Math.round(ef * 140),
  sources: ["mywhoosh"], load: 60, method: "power", intensity: 0.7,
} as unknown as W);
const point = (day: string, o: Partial<DayPoint>): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0, ...o,
});

/** Morgens (7 Uhr) effizienter, spät (21 Uhr) kostet 45 min Schlaf und 10 Punkte Erholung. */
function scenario() {
  const workouts: W[] = [], series: DayPoint[] = [];
  const lateDays = new Set<string>();
  for (let i = 59; i >= 1; i--) {
    const day = addDays(TODAY, -i);
    if (i % 3 === 0) workouts.push(ride(day, 7, 2.1));
    else if (i % 3 === 1) { workouts.push(ride(day, 21, 1.9)); lateDays.add(day); }
  }
  for (let i = 60; i >= 0; i--) {
    const day = addDays(TODAY, -i);
    const afterLate = lateDays.has(addDays(day, -1));
    series.push(point(day, { sleepH: afterLate ? 6.5 : 7.5, sleepPerf: afterLate ? 75 : 88, recovery: afterLate ? 55 : 68 }));
  }
  return { workouts, series };
}

describe("Beste Trainingszeit", () => {
  it("ordnet Uhrzeiten den Zeitfenstern zu", () => {
    expect([6 * 60, 10 * 60, 15 * 60, 19 * 60 + 30, 22 * 60].map(slotOf)).toEqual(["morning", "midday", "afternoon", "evening", "late"]);
  });

  it("findet das effizienteste Fenster und die Kosten später Einheiten", () => {
    const { workouts, series } = scenario();
    const r = timingReport(series, workouts, "UTC", TODAY, 60);
    const by = Object.fromEntries(r.slots.map((s) => [s.slot, s]));
    expect(by.morning.efVsTypicalPct!).toBeGreaterThan(3);
    expect(by.late.efVsTypicalPct!).toBeLessThan(-3);
    // Spätes Training endet um 22 Uhr → Fenster „spät“
    expect(by.late.sleepVsAvgMin!).toBeLessThan(-20);
    expect(by.late.recoveryVsAvg!).toBeLessThan(-5);
    expect(by.morning.recoveryVsAvg!).toBeGreaterThan(0);
    expect(r.hints.join(" ")).toMatch(/morgens/);
    expect(r.hints.join(" ")).toMatch(/spät .*weniger Schlaf/);
  });

  it("ohne Daten: Hinweis auf zu wenige Einheiten", () => {
    const r = timingReport([], [], "UTC", TODAY, 60);
    expect(r.hints[0]).toMatch(/zu wenige/);
  });
});
