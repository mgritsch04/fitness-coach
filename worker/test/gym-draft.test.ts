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
