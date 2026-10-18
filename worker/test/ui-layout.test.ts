import { describe, expect, it } from "vitest";
import { cleanLayout, readLayout, writeLayout } from "../src/core/ui-layout";
import { fakeD1 } from "./fake-d1";

describe("Anordnung für alle Geräte (#67, #322)", () => {
  it("bereinigt fremde Felder und ungültige Kennungen", () => {
    const l = cleanLayout({ hidden: ["cadence", "cadence", "<script>", 5], order: { today: 3, "bad id": 1, x: "1" }, extra: true }, "2026-01-01T00:00:00Z");
    expect(l).toEqual({ hidden: ["cadence"], order: { today: 3 }, deskTabs: true, updatedAt: "2026-01-01T00:00:00Z" });
    expect(cleanLayout({ deskTabs: false }).deskTabs).toBe(false);
  });
  it("speichern, lesen, löschen", async () => {
    const db = fakeD1() as unknown as D1Database;
    expect(await readLayout(db)).toBeNull();
    await writeLayout(db, { hidden: ["weather"], order: {}, deskTabs: false });
    expect(await readLayout(db)).toMatchObject({ hidden: ["weather"], deskTabs: false });
    expect(await writeLayout(db, null)).toBeNull();
    expect(await readLayout(db)).toBeNull();
  });
});
