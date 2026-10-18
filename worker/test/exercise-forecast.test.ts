import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { exerciseForecast } from "../src/core/exercise-forecast";
import type { ExerciseProgress } from "../src/core/strength";

// Synthetische Verläufe, keine echten Messwerte.
const today = "2026-03-31";
const prog = (vals: number[], status: ExerciseProgress["status"] = "progress", every = 7): ExerciseProgress => ({
  exercise: "back_squat",
  name: "Kniebeuge",
  sessions: vals.length,
  history: vals.map((v, i) => ({ day: addDays(today, -every * (vals.length - 1 - i)), e1rmKg: v, topSet: { reps: 5, weightKg: v / (1 + 5 / 30) }, sets: 3 })),
  bestE1rmKg: Math.max(...vals),
  bestDay: null,
  change4wPct: null,
  status,
});

describe("Prognose je Übung (#328)", () => {
  it("schreibt einen steigenden Trend wöchentlich fort", () => {
    const f = exerciseForecast(prog([100, 101, 102, 103, 104]), today);
    expect(f.available).toBe(true);
    expect(f.currentKg).toBeCloseTo(104, 0);
    expect(f.perWeekKg).toBeCloseTo(1, 1);
    expect(f.points).toHaveLength(8);
    expect(f.points[0].day).toBe("2026-04-07");
    expect(f.targetKg).toBeCloseTo(112, 0);
    expect(f.target).toEqual({ reps: 5, weightKg: 95 });
    expect(f.text).toMatch(/in 8 Wochen etwa 112 kg/);
    expect(f.text).toMatch(/Schätzung/);
  });

  it("begrenzt sehr steile Anstiege auf 1,5 % je Woche", () => {
    const f = exerciseForecast(prog([60, 70, 80, 90]), today);
    expect(f.perWeekKg).toBeGreaterThan(1.2);
    expect(f.perWeekKg).toBeLessThanOrEqual(1.4); // 1,5 % von ≈ 90 kg statt 10 kg je Woche
    expect(f.text).toMatch(/begrenzt/);
  });

  it("zeigt bei zu wenig Daten, Plateau oder Rückgang keine Prognose", () => {
    expect(exerciseForecast(prog([100]), today)).toMatchObject({ available: false, points: [] });
    expect(exerciseForecast(prog([100]), today).reason).toMatch(/Zu wenig Daten/);
    expect(exerciseForecast(prog([100, 101, 102], "progress", 3), today).reason).toMatch(/Zu wenig Daten/);
    expect(exerciseForecast(prog([100, 100, 100, 100], "plateau"), today).reason).toMatch(/Plateau/);
    expect(exerciseForecast(prog([110, 105, 100], "decline"), today).reason).toMatch(/Rückgang/);
    expect(exerciseForecast(prog([100, 100.1, 100, 100.1], "unknown"), today).reason).toMatch(/Aufwärtstrend/);
  });
});
