import { describe, expect, it } from "vitest";
import { seasonItems, strengthSeason } from "../src/core/strength-season";
import { strengthWorkout } from "../src/core/strength-plan";

const items = [
  { exercise: "back_squat", sets: 4, reps: 8 },
  { exercise: "romanian_deadlift", sets: 3, reps: 8 },
  { exercise: "lunge", sets: 2, reps: 8 },
  { exercise: "calf_raise", sets: 2, reps: 12 },
  { exercise: "plank", sets: 3, reps: 45, unit: "s" as const },
];

describe("Kraft nach Saisonphase (#213)", () => {
  it("Phase aus Einstellung, Planphase oder Jahreszeit", () => {
    expect(strengthSeason("maintain", "2026-10-12")).toMatchObject({ phase: "build", source: "season", maxPerWeek: null });
    expect(strengthSeason("base", "2026-05-04")).toMatchObject({ phase: "maintain", maxPerWeek: null });
    expect(strengthSeason("build", "2026-01-05")).toMatchObject({ phase: "maintain", source: "plan", maxPerWeek: 2 });
    expect(strengthSeason("taper", "2026-01-05")).toMatchObject({ phase: "race", maxPerWeek: 1 });
    expect(strengthSeason("taper", "2026-01-05", "build")).toMatchObject({ phase: "build", source: "setting" });
  });

  it("Aufbau: ein Satz mehr bei den ersten Grundübungen", () => {
    const r = seasonItems(items, "build");
    expect(r.map((x) => x.sets)).toEqual([5, 4, 2, 2, 3]);
  });

  it("Erhalt: weniger Sätze, schwer, höchstens 4 Übungen", () => {
    const r = seasonItems(items, "maintain");
    expect(r).toHaveLength(4);
    expect(r.map((x) => x.sets)).toEqual([3, 2, 2, 2]);
    expect(r[0].reps).toBe(6);
  });

  it("Wettkampf: 3 Übungen, 2 Sätze, 10 % leichter", () => {
    const r = seasonItems(items, "race");
    expect(r.map((x) => [x.sets, x.reps])).toEqual([[2, 5], [2, 5], [2, 5]]);
    // Synthetische Einheit: Kniebeuge 100 kg, alle Sätze geschafft.
    const sessions = [{ id: 1, day: "2026-01-01", sets: [{ exercise: "back_squat", setIndex: 1, reps: 5, weightKg: 100 }] }] as never;
    const w = strengthWorkout("2026-01-08", { durationMin: 60, focus: "Beine + Rumpf" }, sessions, "race");
    expect(w.exercises).toHaveLength(3);
    expect(w.season).toBe("race");
    expect(w.exercises[0].weightKg).toBeLessThan(100);
  });
});
