import { describe, expect, it } from "vitest";
import { activeComplaints, adaptForComplaints, areaTag, complaintAreas, exerciseLoads } from "../src/core/complaints";
import { exerciseAlternatives, LIBRARY_KEYS } from "../src/core/exercises";
import { strengthWorkout } from "../src/core/strength-plan";
import { suggestFromTemplate } from "../src/core/strength";

const entry = (day: string, tags: string[]) => ({ day, feeling: null, energy: null, soreness: null, stress: null, motivation: null, notes: null, tags });

describe("Beschwerde-Karte (#376)", () => {
  it("liest Stellen aus den Tags und nimmt den jüngsten Check-in", () => {
    expect(complaintAreas(entry("2026-10-20", [areaTag("knee"), "reise"]))).toEqual(["knee"]);
    const es = [entry("2026-10-18", [areaTag("knee")]), entry("2026-10-20", [areaTag("shoulder")])];
    expect(activeComplaints(es, "2026-10-21")).toEqual(["shoulder"]);
    // Check-in ohne Markierung hebt auf; sehr alte Markierung verfällt.
    expect(activeComplaints([...es, entry("2026-10-21", [])], "2026-10-21")).toEqual([]);
    expect(activeComplaints([entry("2026-09-01", [areaTag("knee")])], "2026-10-21")).toEqual([]);
  });

  it("tauscht knie-belastende Übungen gegen eine unkritische Alternative, ohne Doppelungen", () => {
    const tpl = [{ exercise: "back_squat", sets: 4, reps: 5 }, { exercise: "overhead_press", sets: 3, reps: 8 }];
    const r = adaptForComplaints(tpl, ["knee"], []);
    expect(r.items.map((i) => i.exercise)).not.toContain("back_squat");
    expect(r.items.every((i) => !exerciseLoads(i.exercise).includes("knee"))).toBe(true);
    expect(r.items.find((i) => i.exercise === "overhead_press")).toBeTruthy();
    expect(r.adjustments).toHaveLength(1);
    expect(r.adjustments[0].text).toMatch(/Kniebeuge → .*schont Knie/);
  });

  it("ohne Markierung bleibt die Vorlage unverändert; ohne Alternative entfällt die Übung", () => {
    const tpl = [{ exercise: "back_squat", sets: 4, reps: 5 }];
    expect(adaptForComplaints(tpl, [], [])).toEqual({ items: tpl, adjustments: [] });
    const r = adaptForComplaints([{ exercise: "calf_raise", sets: 2, reps: 12 }], ["ankle", "knee"], []);
    expect(r.items).toEqual([]);
    expect(r.adjustments[0].to).toBeNull();
  });

  it("jede Übung der Bibliothek hat für jede Stelle eine Lösung oder entfällt sauber", () => {
    for (const k of LIBRARY_KEYS) for (const a of ["knee", "shoulder", "back", "hip", "elbow", "wrist", "ankle"] as const) {
      const r = adaptForComplaints([{ exercise: k, sets: 3, reps: 8 }], [a], []);
      expect(r.items.every((i) => !exerciseLoads(i.exercise).includes(a))).toBe(true);
      expect(exerciseAlternatives(k, []).alternatives.length).toBeGreaterThan(0);
    }
  });

  it("Wochenplan: Beine-Einheit mit Knie-Markierung nennt die Anpassung, ohne Markierung wie vorher", () => {
    const focus = { durationMin: 60, focus: "Beine + Rumpf" };
    const plain = strengthWorkout("2026-10-21", focus, []);
    const adapted = strengthWorkout("2026-10-21", focus, [], null, ["knee"]);
    expect(plain.adjustments).toEqual([]);
    expect(plain.exercises.some((e) => e.exercise === "back_squat")).toBe(true);
    expect(adapted.exercises.some((e) => e.exercise === "back_squat")).toBe(false);
    expect(adapted.text).toContain("Angepasst wegen deiner Markierung");
    // Markierung entfernt → ursprüngliche Planung kommt zurück.
    expect(strengthWorkout("2026-10-21", focus, [], null, []).exercises.map((e) => e.exercise)).toEqual(plain.exercises.map((e) => e.exercise));
  });

  it("Vorlage Kniebeuge + Schulterdrücken: Knie tauscht die Kniebeuge, Entfernen bringt sie zurück", () => {
    const tpl = [{ exercise: "back_squat", sets: 3, reps: 5, weightKg: 60 }, { exercise: "overhead_press", sets: 3, reps: 8, weightKg: 30 }];
    const withKnee = suggestFromTemplate(adaptForComplaints(tpl, ["knee"], []).items, []).map((x) => x.exercise);
    expect(withKnee).not.toContain("back_squat");
    expect(suggestFromTemplate(adaptForComplaints(tpl, [], []).items, []).map((x) => x.exercise)).toEqual(["back_squat", "overhead_press"]);
  });
});
