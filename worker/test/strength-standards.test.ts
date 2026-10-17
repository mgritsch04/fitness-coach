import { describe, expect, it } from "vitest";
import { strengthStandards } from "../src/core/strength-standards";

// Synthetische Einheiten.
const set = (exercise: string, reps: number, weightKg: number) => ({ exercise, exerciseName: exercise, reps, weightKg });
const sessions = [
  { id: "1", day: "2026-03-10", sets: [set("back_squat", 5, 75), set("bench_press", 5, 60), set("pull_up", 8, 0)] },
  { id: "2", day: "2025-10-01", sets: [set("back_squat", 1, 200)] },
] as never;

describe("Kraft pro kg (#203)", () => {
  it("ordnet 1RM pro Körpergewicht ein, alte Einheiten zählen nicht", () => {
    const r = strengthStandards(sessions, 64, "2026-03-20");
    expect(r.available).toBe(true);
    const sq = r.exercises.find((e) => e.exercise === "back_squat")!;
    expect(sq.e1rmKg).toBe(87.5);
    expect(sq.perKg).toBe(1.37);
    expect(sq.level).toBe("Fortgeschritten");
    expect(sq.next).toEqual({ level: "Stark", e1rmKg: 96 });
    const pu = r.exercises.find((e) => e.exercise === "pull_up")!;
    expect(pu.perKg).toBe(1.27);
    expect(r.note).toContain("Grobe Richtwerte");
  });

  it("ohne Körpergewicht verständlicher Hinweis", () => {
    const r = strengthStandards(sessions, null, "2026-03-20");
    expect(r.available).toBe(false);
    expect(r.text).toContain("Körpergewicht");
  });

  it("ohne passende Übungen nicht verfügbar", () => {
    expect(strengthStandards([], 70, "2026-03-20").available).toBe(false);
  });
});
