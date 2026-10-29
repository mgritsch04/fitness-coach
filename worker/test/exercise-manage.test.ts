import { describe, expect, it } from "vitest";
import { guessMuscles } from "../src/core/exercise-muscles";
import { duplicateCandidates, manageExercises, readOverrides, saveOverride } from "../src/core/exercise-manage";
import { muscleVolume, readStrengthSessions, readTemplates, saveStrengthSession, saveTemplate, suggestFromTemplate } from "../src/core/strength";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch.
const set = (exercise: string, exerciseName: string, reps: number, weightKg: number) => ({ exercise, exerciseName, reps, weightKg, rpe: null, muscles: null });
const base = { startTime: null, durationMin: 40, rpe: 7, name: null, notes: null, linkedSource: null, linkedSourceId: null };

describe("Muskelgruppen aus dem Namen", () => {
  it("erkennt eigene Übungen statt „Sonstige“", () => {
    expect(guessMuscles("Bizeps schwarze")?.primary).toEqual(["biceps"]);
    expect(guessMuscles("bizeps low/high")?.primary).toEqual(["biceps"]);
    expect(guessMuscles("Kurzhantel Curls")?.primary).toEqual(["biceps"]);
    expect(guessMuscles("Trizeps Seilzug")?.primary).toEqual(["triceps"]);
    expect(guessMuscles("Seitheben Maschine")?.primary).toEqual(["shoulders"]);
    expect(guessMuscles("Beinbeuger sitzend")?.primary).toEqual(["hamstrings"]);
    expect(guessMuscles("Brustpresse")?.primary).toEqual(["chest"]);
    expect(guessMuscles("Xyz")).toBeNull();
  });
  it("zählt Volumen nicht mehr als Sonstige", () => {
    const v = muscleVolume([set("bizeps low", "Bizeps low", 10, 20)]);
    expect(v[0].muscle).toBe("biceps");
  });
});

describe("Übungsverwaltung", () => {
  it("führt zusammen, ohne Sätze zu ändern, und lässt sich trennen", async () => {
    const db = fakeD1();
    await saveStrengthSession(db, { ...base, id: "a", day: "2026-03-01", sets: [set("bizeps curls", "Bizeps Curls", 10, 15), set("bizeps curls", "Bizeps Curls", 8, 17.5)] });
    await saveStrengthSession(db, { ...base, id: "b", day: "2026-03-08", sets: [set("bizeps schwarze", "Bizeps schwarze", 10, 20)] });
    expect((await readStrengthSessions(db, "2026-01-01")).flatMap((s) => s.sets.map((x) => x.exercise)).sort()).toEqual(["bizeps curls", "bizeps curls", "bizeps schwarze"]);

    await saveOverride(db, { key: "bizeps curls", mergedInto: "bizeps schwarze", displayName: null, hidden: false, musclesPrimary: null, musclesSecondary: null });
    const merged = await readStrengthSessions(db, "2026-01-01");
    expect(new Set(merged.flatMap((s) => s.sets.map((x) => x.exercise)))).toEqual(new Set(["bizeps schwarze"]));
    const m = manageExercises(await readStrengthSessions(db, "2026-01-01", { raw: true }), [], await readOverrides(db));
    expect(m.exercises).toHaveLength(1);
    expect(m.exercises[0]).toMatchObject({ exercise: "bizeps schwarze", sessions: 2, sets: 3, name: "Bizeps schwarze", mergedFrom: [{ exercise: "bizeps curls", name: "Bizeps Curls" }] });
    expect(m.exercises[0].history.map((h) => h.day)).toEqual(["2026-03-08", "2026-03-01"]);
    expect(m.exercises[0].last).toEqual({ day: "2026-03-08", sets: [{ reps: 10, weightKg: 20 }] });

    await saveOverride(db, { key: "bizeps curls", mergedInto: null, displayName: null, hidden: false, musclesPrimary: null, musclesSecondary: null });
    expect(new Set((await readStrengthSessions(db, "2026-01-01")).flatMap((s) => s.sets.map((x) => x.exercise))).size).toBe(2);
  });

  it("benennt um, blendet aus und überstimmt Muskelgruppen manuell", async () => {
    const db = fakeD1();
    await saveStrengthSession(db, { ...base, id: "a", day: "2026-03-01", sets: [set("xyz", "Xyz", 10, 20)] });
    await saveOverride(db, { key: "xyz", mergedInto: null, displayName: "Rückenzieher", hidden: true, musclesPrimary: ["back"], musclesSecondary: ["biceps"] });
    const s = await readStrengthSessions(db, "2026-01-01");
    expect(s[0].sets[0].exerciseName).toBe("Rückenzieher");
    expect(muscleVolume(s[0].sets).map((v) => v.muscle)).toEqual(["back", "biceps"]);
    const m = manageExercises(await readStrengthSessions(db, "2026-01-01", { raw: true }), [], await readOverrides(db)).exercises[0];
    expect(m).toMatchObject({ hidden: true, muscles: { primary: ["back"], secondary: ["biceps"], source: "manual" } });
  });

  it("schlägt Dubletten mit gemeinsamem Wort vor", () => {
    const g = duplicateCandidates([
      { exercise: "a", name: "Bizeps schwarze", hidden: false },
      { exercise: "b", name: "Bizeps Curls", hidden: false },
      { exercise: "c", name: "Bizeps low/high", hidden: false },
      { exercise: "d", name: "Kniebeuge", hidden: false },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].exercises.map((e) => e.exercise).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("Vorlage wie letztes Mal", () => {
  it("liefert die Sätze vom letzten Mal, auch aus einer anderen Einheit, und folgt Zusammenführungen", async () => {
    const db = fakeD1();
    await saveStrengthSession(db, { ...base, id: "a", day: "2026-03-01", name: "Push", sets: [set("bench_press", "Bankdrücken", 8, 60), set("bench_press", "Bankdrücken", 7, 62.5)] });
    await saveTemplate(db, "Pull", [{ exercise: "bench_press", sets: 3, reps: 8 }, { exercise: "neu", sets: 3, reps: 8 }]);
    const t = (await readTemplates(db))[0];
    const out = suggestFromTemplate(t.exercises, await readStrengthSessions(db, "2026-01-01"));
    expect(out[0].lastSets).toEqual([{ reps: 8, weightKg: 60 }, { reps: 7, weightKg: 62.5 }]);
    expect(out[1].lastSets).toEqual([]);
  });
});

describe("Einseitige Übungen (links/rechts)", () => {
  it("speichert die Seite je Satz, zeigt sie im Verlauf und zählt Volumen je Seite halb", async () => {
    const db = fakeD1();
    const side = (s: "L" | "R", reps: number, kg: number) => ({ ...set("einarmrudern", "Einarmrudern", reps, kg), side: s });
    await saveStrengthSession(db, { ...base, id: "a", day: "2026-03-01", sets: [side("L", 10, 24), side("R", 9, 24), side("L", 8, 24), side("R", 8, 24)] });
    const raw = await readStrengthSessions(db, "2026-01-01", { raw: true });
    expect(raw[0].sets.map((x) => x.side)).toEqual(["L", "R", "L", "R"]);
    const m = manageExercises(raw, [], await readOverrides(db)).exercises[0];
    expect(m.unilateral).toBe(true);
    expect(m.last?.sets[1]).toEqual({ reps: 9, weightKg: 24, side: "R" });
    // 4 Seiten-Sätze = 2 volle Sätze
    expect(muscleVolume(raw[0].sets)[0].sets).toBe(2);
    await saveOverride(db, { key: "xyz", mergedInto: null, displayName: null, hidden: false, musclesPrimary: null, musclesSecondary: null, unilateral: true });
    expect((await readOverrides(db)).get("xyz")?.unilateral).toBe(true);
  });
});
