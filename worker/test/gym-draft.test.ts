import { describe, expect, it } from "vitest";
import { clearGymDraft, readGymDraft, saveGymDraft } from "../src/core/strength";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch.
describe("Gym-Entwurf", () => {
  it("ist anfangs leer, wird überschrieben und lässt sich löschen", async () => {
    const db = fakeD1();
    expect(await readGymDraft(db)).toBeNull();
    await saveGymDraft(db, JSON.stringify({ exercises: [{ name: "A" }] }));
    await saveGymDraft(db, JSON.stringify({ exercises: [{ name: "B" }] }));
    expect(JSON.parse((await readGymDraft(db))!.data).exercises[0].name).toBe("B");
    await clearGymDraft(db);
    expect(await readGymDraft(db)).toBeNull();
  });
});

import { readStrengthSessions, saveStrengthSession } from "../src/core/strength";

describe("Einheit mit unzuverlässigen Wiederholungen", () => {
  it("fehlt in der Statistik, ist aber auflistbar", async () => {
    const db = fakeD1();
    const base = { startTime: null, durationMin: 30, rpe: 5, name: null, notes: null, linkedSource: null, linkedSourceId: null, sets: [{ exercise: "x", exerciseName: "X", reps: 5, weightKg: 20, rpe: null, muscles: null }] };
    await saveStrengthSession(db, { ...base, id: "a", day: "2026-03-01" });
    await saveStrengthSession(db, { ...base, id: "b", day: "2026-03-02", repsUnreliable: true });
    expect((await readStrengthSessions(db, "2026-03-01")).map((s) => s.id)).toEqual(["a"]);
    const all = await readStrengthSessions(db, "2026-03-01", { withUnreliable: true });
    expect(all.map((s) => s.id)).toEqual(["b", "a"]);
    expect(all[0].repsUnreliable).toBe(true);
    expect(all[0].sets).toHaveLength(1);
  });
});
