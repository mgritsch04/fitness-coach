import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import type { StrengthSession } from "../src/core/strength";
import { strengthDeload } from "../src/core/strength-deload";

const TODAY = "2026-03-31";
/** Synthetische Einheiten: alle 4 Tage, je Übung ein Satz 5 Wdh.; Gewicht als Funktion vom Index. */
function sessions(weights: Record<string, (i: number) => number>, rpe: (i: number) => number | null = () => null): StrengthSession[] {
  const out: StrengthSession[] = [];
  for (let i = 0; i < 11; i++) {
    const day = addDays(TODAY, -40 + i * 4);
    out.push({ id: `s${i}`, day, startTime: null, durationMin: 45, rpe: rpe(i), name: null, notes: null, linkedSource: null, linkedSourceId: null,
      sets: Object.entries(weights).map(([exercise, w]) => ({ exercise, exerciseName: exercise, reps: 5, weightKg: w(i) })) });
  }
  return out;
}

describe("strengthDeload", () => {
  it("zu wenige Daten", () => {
    expect(strengthDeload([], TODAY).verdict).toBe("insufficient");
    expect(strengthDeload(sessions({ back_squat: () => 100 }), TODAY).verdict).toBe("insufficient");
  });
  it("Fortschritt: kein Hinweis", () => {
    const r = strengthDeload(sessions({ back_squat: (i) => 80 + i * 2.5, bench_press: (i) => 60 + i * 1.25 }), TODAY);
    expect(r.verdict).toBe("ok");
    expect(r.exercises.every((e) => e.status === "progress")).toBe(true);
    expect(r.suggestion).toBeNull();
  });
  it("Plateau bei steigender RPE → Entlastungswoche", () => {
    const r = strengthDeload(sessions({ back_squat: () => 100, bench_press: () => 70, barbell_row: (i) => 60 + i * 2 }, (i) => 7 + i * 0.2), TODAY);
    expect(r.verdict).toBe("deload");
    expect(r.exercises.find((e) => e.exercise === "back_squat")!.status).toBe("plateau");
    expect(r.exercises.find((e) => e.exercise === "back_squat")!.rpeChange).toBeGreaterThanOrEqual(0.5);
    expect(r.suggestion).toMatchObject({ weeks: 1, volumePct: -40, weightPct: -10 });
    expect(r.text).toContain("Anstrengung steigt");
  });
  it("eine stagnierende Übung von drei: nur beobachten", () => {
    const r = strengthDeload(sessions({ back_squat: () => 100, bench_press: (i) => 60 + i * 2, deadlift: (i) => 120 + i * 3 }), TODAY);
    expect(r.verdict).toBe("watch");
    expect(r.text).toContain("Kniebeuge");
  });
  it("Rückgang bei zwei Übungen → Entlastungswoche", () => {
    const r = strengthDeload(sessions({ back_squat: (i) => 110 - i * 2, bench_press: (i) => 80 - i * 1.5 }), TODAY);
    expect(r.exercises.every((e) => e.status === "decline")).toBe(true);
    expect(r.verdict).toBe("deload");
  });
});
