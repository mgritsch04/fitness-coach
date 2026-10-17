import { describe, expect, it } from "vitest";
import { MOBILITY_KINDS, mobilityKindFor, mobilityKindForActual, mobilityRoutine } from "../src/core/mobility";

// Synthetische Planeinheiten.
const s = (type: string, durationMin: number, focus?: string) => ({ type, durationMin, strength: focus ? { durationMin: 40, focus } : null }) as never;

describe("Mobility nach der Einheit (#223)", () => {
  it("wählt die Routine nach Einheit und Kraftfokus", () => {
    expect(mobilityKindFor(s("long", 150))).toBe("ride_long");
    expect(mobilityKindFor(s("threshold", 75))).toBe("ride_intervals");
    expect(mobilityKindFor(s("tempo", 70, "Beine + Rumpf (schwer)"))).toBe("legs");
    expect(mobilityKindFor(s("strength", 40, "Oberkörper (Zug)"))).toBe("upper");
    expect(mobilityKindFor(s("rest", 0))).toBe("general");
    expect(mobilityKindFor(null)).toBe("general");
  });

  it("jede Routine dauert 5–10 min", () => {
    for (const k of MOBILITY_KINDS) {
      const r = mobilityRoutine(k);
      expect(r.minutes).toBeGreaterThanOrEqual(5);
      expect(r.minutes).toBeLessThanOrEqual(10);
      expect(r.exercises.every((e) => e.seconds >= 15 && e.cue)).toBe(true);
    }
  });

  it("richtet sich nach der tatsächlichen Einheit (#297)", () => {
    const day = "2026-03-31", long = s("long", 150);
    const ride = (min: number, load: number) => ({ day, sport: "cycling", durationMin: min, load });
    const gym = (exercises: string[]) => ({ id: "x", day, startTime: null, durationMin: 60, rpe: null, name: null, notes: null, linkedSource: null, linkedSourceId: null,
      sets: exercises.map((exercise) => ({ exercise, exerciseName: exercise, reps: 8, weightKg: 50 })) });
    // Geplant war die lange Fahrt, gemacht wurde nur Oberkörper.
    expect(mobilityKindForActual(day, [{ day, sport: "weightlifting", durationMin: 60, load: 40 }], [gym(["bench_press", "barbell_row"])], long)).toEqual({ kind: "upper", basis: "actual" });
    expect(mobilityKindForActual(day, [], [gym(["back_squat", "bench_press"])], long)).toEqual({ kind: "legs", basis: "actual" });
    expect(mobilityKindForActual(day, [ride(100, 90)], [], null)).toEqual({ kind: "ride_long", basis: "actual" });
    expect(mobilityKindForActual(day, [ride(60, 85)], [], null)).toEqual({ kind: "ride_intervals", basis: "actual" });
    expect(mobilityKindForActual(day, [ride(45, 35)], [], null)).toEqual({ kind: "ride_long", basis: "actual" });
    // Nichts trainiert (oder Kraft ohne Sätze): wie bisher nach Plan.
    expect(mobilityKindForActual(day, [{ day, sport: "weightlifting", durationMin: 50, load: 30 }], [], long)).toEqual({ kind: "ride_long", basis: "plan" });
    expect(mobilityKindForActual(day, [ride(90, 60)].map((w) => ({ ...w, day: "2026-03-30" })), [], null)).toEqual({ kind: "general", basis: "plan" });
  });
});
