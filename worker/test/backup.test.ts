import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, buildBackup } from "../src/backup-tools";
import { upsertBody } from "../src/core/repository";
import { fakeD1 } from "./fake-d1";

// Synthetische Werte, keine echten Messwerte.

describe("Datensicherung", () => {
  it("enthält alle eigenen Tabellen, aber keine Tokens", async () => {
    const db = fakeD1();
    await upsertBody(db, { source: "whoop", measuredAt: "2026-03-01", heightM: null, weightKg: 77.5, maxHr: null }).run();
    await db.prepare("INSERT INTO journal (day, notes) VALUES (?, ?)").bind("2026-03-01", "Testnotiz").run();
    const b = await buildBackup(db, new Date("2026-03-02T10:00:00Z"));
    expect(b.fileName).toBe("fitness-sicherung-2026-03-02.json");
    expect(Object.keys(b.tables)).toEqual(BACKUP_TABLES.map(([t]) => t));
    expect(b.counts.body_measurements).toBe(1);
    expect(b.counts.journal).toBe(1);
    expect(JSON.stringify(b)).not.toMatch(/whoop_tokens|wahoo_tokens|app_owner/);
    expect(Object.keys(b.tables)).not.toContain("workout_streams");
  });
});
