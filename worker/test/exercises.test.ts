import { describe, expect, it } from "vitest";
import { exerciseAlternatives, LIBRARY_KEYS } from "../src/core/exercises";
import { EXERCISES } from "../src/core/strength";

// Synthetische Einheiten.
const sessions = [
  { id: "1", day: "2026-03-01", sets: [{ exercise: "leg_press", exerciseName: "Beinpresse", reps: 10, weightKg: 140 }] },
  { id: "2", day: "2026-03-08", sets: [{ exercise: "leg_press", exerciseName: "Beinpresse", reps: 10, weightKg: 150 }, { exercise: "leg_press", exerciseName: "Beinpresse", reps: 10, weightKg: 145 }] },
] as never;

describe("Übung tauschen (#204)", () => {
  it("Bibliothek: alle Alternativen sind bekannte Übungen und nie die Übung selbst", () => {
    for (const k of LIBRARY_KEYS) {
      expect(EXERCISES[k]).toBeTruthy();
      const r = exerciseAlternatives(k, []);
      expect(r.alternatives.length).toBeGreaterThan(0);
      expect(r.alternatives.every((a) => a.exercise !== k && EXERCISES[a.exercise])).toBe(true);
    }
  });

  it("Name statt Schlüssel, Startgewicht aus der letzten Einheit", () => {
    const r = exerciseAlternatives("Kniebeuge", sessions);
    expect(r.exercise).toBe("back_squat");
    expect(r.pattern).toBe("squat");
    expect(r.alternatives[0]).toMatchObject({ exercise: "leg_press", startKg: 150, lastDay: "2026-03-08", basis: "history" });
    expect(r.alternatives[1].basis).toBe("choose");
  });

  it("schon in der Einheit vorhandene Übungen werden ausgelassen, unbekannte ohne Vorschlag", () => {
    expect(exerciseAlternatives("back_squat", [], ["Beinpresse"]).alternatives.map((a) => a.exercise)).not.toContain("leg_press");
    const u = exerciseAlternatives("Sandsack werfen", []);
    expect(u.known).toBe(false);
    expect(u.alternatives).toEqual([]);
  });
});
