import { describe, expect, it } from "vitest";
import { toZwo, templateWorkout, findTemplate, weekRideWorkouts, workoutForSession } from "../src/core/bike-workout";

// Synthetische Pläne, keine echten Messwerte (#337).
describe("Workout zur Radeinheit (#337)", () => {
  it("kein Workout für Ruhe, Kraft oder 0 Minuten", () => {
    expect(workoutForSession("rest", 60)).toBeNull();
    expect(workoutForSession("strength", 45)).toBeNull();
    expect(workoutForSession("endurance", 0)).toBeNull();
  });
  it("nimmt die Vorlage der Art, die zur Dauer passt", () => {
    const w = workoutForSession("tempo", 80, "2026-03-04")!;
    expect(w.source).toBe("library");
    expect(w.templateId).toMatch(/^ss-/);
    expect(w.durationMin).toBeLessThanOrEqual(85);
    expect(w.searchTerm).toBe("Sweet Spot");
    expect(w.fileName).toMatch(/^2026-03-04-.*\.zwo$/);
    expect(w.profile.length).toBeGreaterThan(2);
  });
  it("lockere Ausfahrt 30 min = Ausrollen aus der Bibliothek", () => {
    const w = workoutForSession("recovery", 30)!;
    expect(w.templateId).toBe("rec-30");
    expect(w.durationMin).toBe(30);
  });
  it("baut die Einheit selbst, wenn keine Vorlage in die Zeit passt", () => {
    const w = workoutForSession("vo2max", 40)!;
    expect(w.source).toBe("generated");
    expect(w.templateId).toBeNull();
    expect(w.summary).toMatch(/VO2max/);
    const o = workoutForSession("opener", 45)!;
    expect(o.source).toBe("generated");
    expect(o.searchTerm).toBeNull();
  });
  it("schaut auf die Erholung: bei Rot keine harte Vorlage", () => {
    const hard = workoutForSession("vo2max", 90, null, 20)!;
    expect(hard.templateId === null || !hard.templateId.startsWith("vo-")).toBe(true);
    expect(workoutForSession("endurance", 75, null, 20)!.templateId).not.toBe("end-90");
  });
  it("die Datei zur Empfehlung ist gültiges ZWO", () => {
    const w = workoutForSession("threshold", 90)!;
    const tpl = findTemplate(w.templateId!);
    const xml = toZwo(templateWorkout(tpl!));
    expect(xml).toContain("<workout_file>");
    expect(xml).toContain("<IntervalsT");
  });
  it("weekRideWorkouts: nur Radtage ab heute", () => {
    const days = [
      { day: "2026-03-02", type: "tempo" as const, durationMin: 75 },
      { day: "2026-03-03", type: "rest" as const, durationMin: 0 },
      { day: "2026-03-04", type: "strength" as const, durationMin: 45 },
      { day: "2026-03-05", type: "endurance" as const, durationMin: 60 },
    ];
    const r = weekRideWorkouts(days, "2026-03-03", null);
    expect(r.map((x) => x.day)).toEqual(["2026-03-05"]);
  });
});
