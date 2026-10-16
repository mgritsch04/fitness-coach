import { describe, expect, it } from "vitest";
import { addDays, type DayPoint, type MergedWorkout, type WorkoutLoad } from "../src/core/analysis";
import { interferenceReport, legSessions, ridesAfterLegs, rideEffects, suggestGap } from "../src/core/interference";
import type { StrengthSession } from "../src/core/strength";

// Synthetische Wochen, keine echten Messwerte: Beine am Montag 17 Uhr, Radeinheiten an anderen Tagen um 17 Uhr.
const TODAY = "2026-04-30";
type W = MergedWorkout & WorkoutLoad;
const ride = (day: string, ef: number, intensity = 0.7): W => ({
  day, source: "mywhoosh", source_id: day, start_time: `${day}T17:00:00Z`, end_time: `${day}T18:00:00Z`, sport: "cycling", duration_s: 3600,
  distance_m: 30000, energy_kj: null, avg_hr: 140, max_hr: null, avg_power_w: null, normalized_power_w: Math.round(ef * 140),
  sources: ["mywhoosh"], load: 60, method: "power", intensity,
} as unknown as W);
const legs = (day: string, sets = 6): StrengthSession => ({
  id: day, day, startTime: `${day}T16:00:00Z`, durationMin: 60, rpe: 8, name: null, notes: null, linkedSource: null, linkedSourceId: null,
  sets: Array.from({ length: sets }, () => ({ exercise: "back_squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 100 })),
});
const point = (day: string, o: Partial<DayPoint>): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0, ...o,
});

function scenario(weeks: number) {
  const strength: StrengthSession[] = [], workouts: W[] = [], series: DayPoint[] = [];
  // Wochenstart so wählen, dass die letzte Woche vor TODAY endet
  for (let k = weeks; k >= 1; k--) {
    const mon = addDays(TODAY, -7 * k);
    strength.push(legs(mon));
    // 1 Tag danach (24 h): Effizienz −6 %, 2 Tage danach (48 h): −1 %, 4 Tage danach: normal
    workouts.push(ride(addDays(mon, 1), 1.88), ride(addDays(mon, 2), 1.98), ride(addDays(mon, 4), 2.0));
  }
  for (let i = 7 * weeks; i >= 0; i--) {
    const day = addDays(TODAY, -i);
    const afterLegs = strength.some((s) => s.day === addDays(day, -1));
    const trained = strength.some((s) => s.day === day) || workouts.some((w) => w.day === day);
    series.push(point(day, { recovery: afterLegs ? 50 : 65, hrv: afterLegs ? 50 : 60, workouts: trained ? 1 : 0 }));
  }
  return { strength, workouts, series };
}

describe("Kraft und Rad im Wechselspiel", () => {
  it("erkennt Beineinheiten erst ab 3 Beinsätzen", () => {
    expect(legSessions([legs("2026-04-01", 2), legs("2026-04-02", 3)]).map((l) => l.day)).toEqual(["2026-04-02"]);
    const upper: StrengthSession = { ...legs("2026-04-03"), sets: [{ exercise: "bench_press", exerciseName: "Bankdrücken", reps: 5, weightKg: 80 }] };
    expect(legSessions([upper])).toEqual([]);
  });

  it("ordnet Fahrten nach Abstand zu den Beinen ein", () => {
    const s = scenario(1);
    const rides = ridesAfterLegs(s.workouts, legSessions(s.strength), "2026-01-01");
    expect(rides.map((r) => [r.gapH, r.bucket])).toEqual([[24, "24to48"], [48, "48to72"], [96, "gt72"]]);
  });

  it("Folgetag nach Beinen schlechter, Mindestabstand aus der Effizienz", () => {
    const s = scenario(8);
    const r = interferenceReport(s, TODAY, 90);
    const afterLegs = r.nextDay.groups.find((g) => g.group === "afterLegs")!;
    expect(afterLegs.days).toBe(8);
    expect(afterLegs.recoveryVsAvg!).toBeLessThan(-5);
    expect(afterLegs.hrvVsAvgPct!).toBeLessThan(-5);
    const by = Object.fromEntries(r.nextRide.map((e) => [e.bucket, e]));
    expect(by["24to48"].efVsTypicalPct!).toBeLessThan(-3);
    expect(by["48to72"].efVsTypicalPct!).toBeGreaterThan(-2);
    expect(r.suggestion.hours).toBe(48);
    expect(r.suggestion.text).toMatch(/48 h/);
  });

  it("zu wenige Daten: keine Empfehlung", () => {
    const s = scenario(1);
    expect(suggestGap(rideEffects(ridesAfterLegs(s.workouts, legSessions(s.strength), "2026-01-01"))).hours).toBeNull();
  });
});
