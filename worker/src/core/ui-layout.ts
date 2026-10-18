// Anordnung des Dashboards für alle Geräte (#67, #322): ausgeblendete Bereiche, Reihenfolge und „Reiter am PC“.
// Liegt in der Einstellungstabelle; jedes Gerät kann stattdessen eine eigene Anordnung im Browser behalten.

export interface UiLayout {
  hidden: string[];
  order: Record<string, number>;
  /** Am PC Reiter statt einer langen Seite (#322). */
  deskTabs: boolean;
  updatedAt: string;
}

const KEY = "dashboardLayout";
const ID = /^[a-z0-9_-]{1,40}$/;

/** Nur bekannte Felder und gültige Bereichs-Kennungen übernehmen. */
export function cleanLayout(v: unknown, now = new Date().toISOString()): UiLayout {
  const o = (v ?? {}) as Partial<UiLayout>;
  const hidden = [...new Set((Array.isArray(o.hidden) ? o.hidden : []).filter((x): x is string => typeof x === "string" && ID.test(x)))].slice(0, 100);
  const order: Record<string, number> = {};
  for (const [k, n] of Object.entries(o.order && typeof o.order === "object" ? o.order : {}).slice(0, 100)) if (ID.test(k) && typeof n === "number" && Number.isFinite(n)) order[k] = n;
  return { hidden, order, deskTabs: o.deskTabs !== false, updatedAt: now };
}

export async function readLayout(db: D1Database): Promise<UiLayout | null> {
  const r = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(KEY).first<{ value: string }>();
  if (!r) return null;
  const v = JSON.parse(r.value) as UiLayout;
  return { ...cleanLayout(v, v.updatedAt), updatedAt: v.updatedAt };
}

/** null löscht die gemeinsame Anordnung (dann gilt wieder der Standard). */
export async function writeLayout(db: D1Database, v: unknown | null): Promise<UiLayout | null> {
  if (v === null) {
    await db.prepare("DELETE FROM settings WHERE key = ?").bind(KEY).run();
    return null;
  }
  const l = cleanLayout(v);
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(KEY, JSON.stringify(l))
    .run();
  return l;
}
