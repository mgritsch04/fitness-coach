import { describe, expect, it } from "vitest";
import { bestRepsAtLeast, repRecordFor, repRecords } from "../src/core/rep-records";
import type { StrengthSession } from "../src/core/strength";

// Synthetische Bankdrück-Historie.
const set = (reps: number, weightKg: number) => ({ exercise: "bench_press", exerciseName: "Bankdrücken", reps, weightKg });
const sess = (day: string, sets: ReturnType<typeof set>[]): StrengthSession =>
  ({ id: day, day, startTime: null, durationMin: 60, rpe: null, name: null, notes: null, linkedSource: null, linkedSourceId: null, sets });
const history = [
  sess("2026-09-01", [set(8, 70), set(6, 75)]),
  sess("2026-09-08", [set(7, 80), set(5, 85), set(4, 80)]),
  sess("2026-09-15", [set(10, 60), set(0, 90), set(5, 0)]),
];

describe("Wiederholungsrekorde je Gewicht (#299)", () => {
  it("baut die Treppe aus Bestmarken", () => {
    const [r] = repRecords(history);
    expect(r.name).toBe("Bankdrücken");
    // 75 kg × 6 wird von 80 kg × 7 übertroffen und fällt weg.
    expect(r.marks.map((m) => [m.kg, m.reps])).toEqual([[85, 5], [80, 7], [70, 8], [60, 10]]);
    expect(r.marks.find((m) => m.kg === 80)?.day).toBe("2026-09-08");
  });

  it("vergleicht mit gleich schweren oder schwereren Sätzen", () => {
    const { marks } = repRecords(history)[0];
    expect(bestRepsAtLeast(marks, 75)).toBe(7);
    expect(bestRepsAtLeast(marks, 90)).toBeNull();
    expect(repRecordFor(marks, 80, 8)?.text).toBe("Wiederholungsrekord: erstmals 8 Wdh. mit 80 kg (bisher höchstens 7).");
    expect(repRecordFor(marks, 77.5, 8)?.prev).toBe(7);
    expect(repRecordFor(marks, 80, 7)).toBeNull();
    expect(repRecordFor(marks, 72.5, 7)).toBeNull(); // 80 kg × 7 war schon schwerer
    expect(repRecordFor(marks, 95, 1)).toBeNull(); // noch nie so schwer: das meldet der 1RM-Bestwert
  });

  it("ignoriert Sätze nach dem Stichtag", () => {
    const [r] = repRecords(history, "2026-09-05");
    expect(r.marks.map((m) => [m.kg, m.reps])).toEqual([[75, 6], [70, 8]]);
  });
});
