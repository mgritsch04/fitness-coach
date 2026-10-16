import { describe, expect, it } from "vitest";
import { exercisesFor, muscleBalance } from "../src/core/muscle-balance";
import type { StrengthSession, StrengthSet } from "../src/core/strength";

// Synthetische Krafteinheiten, keine echten Messwerte.
const TODAY = "2026-04-30";
const sets = (exercise: string, n: number): StrengthSet[] => Array.from({ length: n }, () => ({ exercise, exerciseName: exercise, reps: 8, weightKg: 50 }));
const session = (day: string, s: StrengthSet[]): StrengthSession => ({ id: day, day, startTime: null, durationMin: 45, rpe: 7, name: null, notes: null, linkedSource: null, linkedSourceId: null, sets: s });

describe("Muskelbalance", () => {
  it("Wochenmittel, Status und Verhältnisse", () => {
    // 2 Wochen à 1 Einheit: 8 Sätze Bankdrücken, 2 Latziehen, 8 Beinstrecker, 2 Beinbeuger
    const s = ["2026-04-22", "2026-04-29"].map((d) => session(d, [...sets("bench_press", 8), ...sets("lat_pulldown", 2), ...sets("leg_extension", 8), ...sets("leg_curl", 2)]));
    const r = muscleBalance(s, TODAY, 2);
    const by = Object.fromEntries(r.muscles.map((m) => [m.muscle, m]));
    expect(by.chest.setsPerWeek).toBe(8);
    expect(by.chest.status).toBe("ok");
    expect(by.back.setsPerWeek).toBe(2);
    expect(by.back.status).toBe("low");
    expect(by.glutes.status).toBe("none");
    // Drücken: 8 Brust + je 8 halbe Sätze Trizeps und Schulter = 16; Ziehen: 2 Rücken + 1 Bizeps = 3
    expect(r.ratios.pullPush).toBe(0.19);
    expect(r.ratios.hamQuad).toBe(0.25);
    const text = r.hints.join(" ");
    expect(text).toMatch(/Gar nicht trainiert: .*Gesäß/);
    expect(text).toMatch(/Mehr Ziehen als Drücken/);
    expect(text).toMatch(/Oberschenkel-Rückseite/);
  });

  it("ausgewogen und ohne Einheiten", () => {
    const all = [...sets("back_squat", 3), ...sets("romanian_deadlift", 2), ...sets("barbell_row", 5), ...sets("bench_press", 3), ...sets("overhead_press", 2), ...sets("plank", 2), ...sets("calf_raise", 2), ...sets("biceps_curl", 1), ...sets("triceps_extension", 1)];
    const r = muscleBalance(["2026-04-27", "2026-04-29"].map((d) => session(d, all)), TODAY, 1);
    expect(r.hints).toEqual(["Ausgewogen: alle großen Muskelgruppen liegen im Zielbereich."]);
    expect(muscleBalance([], TODAY, 4).hints[0]).toMatch(/Keine Krafteinheit/);
  });

  it("Übungsvorschläge aus dem Katalog", () => {
    expect(exercisesFor("hamstrings")).toEqual(["Beinbeuger", "Kreuzheben"]);
  });
});
