import { describe, expect, it } from "vitest";
import { RIR_RPE, nextSetWeight, rirTrend } from "../src/core/autoregulation";
import type { StrengthSession } from "../src/core/strength";

// Synthetische Einheiten.
const session = (day: string, exercise: string, rpes: (number | null)[]): StrengthSession => ({
  id: day + exercise, day, startTime: null, durationMin: 60, rpe: null, name: null, notes: null, linkedSource: null, linkedSourceId: null,
  sets: rpes.map((rpe) => ({ exercise, exerciseName: exercise, reps: 5, weightKg: 100, rpe })),
});

describe("Reserve je Satz (#280)", () => {
  it("schlägt das nächste Gewicht vor", () => {
    expect(nextSetWeight(100, "1-2", { bar: true })).toBe(100);
    expect(nextSetWeight(100, "3+", { bar: true })).toBe(102.5);
    expect(nextSetWeight(100, "0", { bar: true })).toBe(95);
    expect(nextSetWeight(20, "3+")).toBe(21); // Kurzhantel: mindestens 1 kg mehr
    expect(nextSetWeight(20, "3+", { bar: true })).toBe(22.5); // Langhantel: ein Scheibenschritt
    expect(nextSetWeight(0, "3+")).toBe(0); // Körpergewicht bleibt
    expect(RIR_RPE["0"]).toBe(10);
  });

  it("bewertet die Reserve über mehrere Einheiten", () => {
    const today = "2026-03-31";
    const r = rirTrend([
      session("2026-03-20", "back_squat", [7, 7, 7]),
      session("2026-03-27", "back_squat", [7, 6.5, 7]),
      session("2026-03-24", "bench_press", [10, 10]),
      session("2026-03-29", "bench_press", [10, 9.5]),
      session("2026-03-29", "deadlift", [8.5]), // nur eine Einheit
      session("2026-02-01", "overhead_press", [7, 7]), // zu alt
      session("2026-03-28", "overhead_press", [null]),
    ], today);
    expect(r.exercises.map((x) => [x.exercise, x.verdict])).toEqual([["back_squat", "up"], ["bench_press", "down"]]);
    expect(r.text).toContain("darf steigen");
    expect(rirTrend([], today).text).toContain("Noch keine");
  });
});
