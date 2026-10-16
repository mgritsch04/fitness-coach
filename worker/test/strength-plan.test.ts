import { describe, expect, it } from "vitest";
import type { StrengthSession } from "../src/core/strength";
import { strengthWorkout } from "../src/core/strength-plan";

const session = (day: string, sets: { exercise: string; reps: number; weightKg: number }[]): StrengthSession => ({
  id: day, day, startTime: null, durationMin: 45, rpe: null, name: null, notes: null, linkedSource: null, linkedSourceId: null,
  sets: sets.map((s) => ({ ...s, exerciseName: s.exercise })),
});

describe("strengthWorkout", () => {
  it("wählt Übungen nach Fokus und Zeit, ohne Vorwerte ohne Gewicht", () => {
    const w = strengthWorkout("2026-03-24", { durationMin: 30, focus: "Beine + Rumpf (schwer, wenige Wiederholungen)" }, []);
    expect(w.exercises.map((e) => e.exercise)).toEqual(["back_squat", "romanian_deadlift", "lunge"]);
    expect(w.exercises.every((e) => e.weightKg == null)).toBe(true);
    expect(w.text).toContain("2 Wiederholungen");
  });
  it("übernimmt Gewichte und steigert nach geschafften Sätzen", () => {
    const hist = [session("2026-03-20", [
      ...Array.from({ length: 4 }, () => ({ exercise: "pull_up", reps: 6, weightKg: 5 })),
      ...Array.from({ length: 3 }, () => ({ exercise: "cable_row", reps: 8, weightKg: 50 })),
    ])];
    const w = strengthWorkout("2026-03-24", { durationMin: 45, focus: "Oberkörper (Zug)" }, hist);
    const pull = w.exercises.find((e) => e.exercise === "pull_up")!;
    const row = w.exercises.find((e) => e.exercise === "cable_row")!;
    expect(pull).toMatchObject({ weightKg: 7.5, basis: "increase" });
    expect(row).toMatchObject({ weightKg: 50, basis: "repeat" }); // nur 8 von 10 Wdh.
    expect(w.exercises).toHaveLength(4);
    expect(w.text).toContain("Klimmzug 4 × 6 mit 7,5 kg (+)");
  });
  it("leichter Fokus: etwa 60 % der Gewichte; Halteübungen in Sekunden", () => {
    const hist = [session("2026-03-20", [{ exercise: "leg_press", reps: 10, weightKg: 100 }])];
    const w = strengthWorkout("2026-03-24", { durationMin: 60, focus: "Ganzkörper leicht (Technik, ~60 % der üblichen Gewichte)" }, hist);
    expect(w.exercises[0]).toMatchObject({ exercise: "leg_press", weightKg: 60, basis: "light" });
    expect(w.exercises.at(-1)).toMatchObject({ exercise: "plank", unit: "s", weightKg: null });
  });
  it("unbekannter Fokus (von Claude) fällt auf Ganzkörper zurück", () => {
    const w = strengthWorkout("2026-03-24", { durationMin: 40, focus: "Stabi für den Rücken" }, []);
    expect(w.exercises[0].exercise).toBe("leg_press");
  });
});
