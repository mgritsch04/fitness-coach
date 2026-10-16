// Persönliche Einstellungen in D1 (Tabelle `settings`).
import type { UserSettings } from "./analysis";

const KEYS = ["ftpW", "maxHr", "restingHr", "thresholdHr", "sleepNeedH", "timezone"] as const satisfies readonly (keyof UserSettings)[];

export async function readSettings(db: D1Database): Promise<UserSettings> {
  const { results } = await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const out: Record<string, unknown> = {};
  for (const r of results) if ((KEYS as readonly string[]).includes(r.key)) out[r.key] = JSON.parse(r.value);
  return out as UserSettings;
}

/** Setzt die übergebenen Werte; `null` löscht einen Wert (dann gilt wieder die Schätzung). */
export async function writeSettings(db: D1Database, patch: Partial<Record<keyof UserSettings, unknown>>): Promise<UserSettings> {
  const stmts: D1PreparedStatement[] = [];
  for (const k of KEYS) {
    if (!(k in patch) || patch[k] === undefined) continue;
    const v = patch[k];
    stmts.push(
      v === null
        ? db.prepare("DELETE FROM settings WHERE key = ?").bind(k)
        : db
            .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
            .bind(k, JSON.stringify(v)),
    );
  }
  if (stmts.length) await db.batch(stmts);
  return readSettings(db);
}
