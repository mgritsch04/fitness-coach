import { describe, expect, it } from "vitest";
import { readPrefs, writePrefs } from "../src/core/goals";
import { fakeD1 } from "./fake-d1";

describe("Rad und Kraft getrennt je Tag", () => {
  it("speichert rideByDay neben templateByDay, ältere Pläne bleiben lesbar", async () => {
    const db = fakeD1();
    await writePrefs(db, { templateByDay: ["@rad", "Push", "@ruhe", null, null, null, null] });
    expect((await readPrefs(db)).rideByDay).toBeNull();
    const p = await writePrefs(db, { templateByDay: [null, "Push", "@ruhe", null, null, null, null], rideByDay: [true, true, null, null, null, null, null] });
    expect(p.templateByDay?.[1]).toBe("Push");
    expect(p.rideByDay?.[1]).toBe(true);
    expect((await writePrefs(db, { rideByDay: null })).rideByDay).toBeNull();
  });
});
