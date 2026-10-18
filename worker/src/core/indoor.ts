// Winterbetrieb (#326): „nur Rolle“ als feste Einstellung, optional bis zu einem Datum.
// Ist er aktiv, raten Radwetter, Wochenplan und Tagesempfehlung nicht zum Fahren draußen und beschreiben die Einheiten für die Rolle.

export interface IndoorMode {
  /** Schalter „Winter: nur Rolle“. */
  on: boolean;
  /** Letzter Tag (YYYY-MM-DD), danach gilt der Schalter automatisch nicht mehr; null = ohne Ende. */
  until: string | null;
}

export interface IndoorState extends IndoorMode {
  /** Heute wirksam (on und noch nicht abgelaufen). */
  active: boolean;
}

const KEY = "indoorMode";
export const INDOOR_OFF: IndoorMode = { on: false, until: null };

export const indoorState = (m: IndoorMode, today: string): IndoorState => ({ ...m, active: m.on && (!m.until || today <= m.until) });

export async function readIndoor(db: D1Database): Promise<IndoorMode> {
  const r = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(KEY).first<{ value: string }>();
  if (!r) return { ...INDOOR_OFF };
  const v = JSON.parse(r.value) as Partial<IndoorMode>;
  return { on: Boolean(v.on), until: typeof v.until === "string" ? v.until : null };
}

/** Setzt die übergebenen Felder; `null` bei until entfernt das Enddatum. */
export async function writeIndoor(db: D1Database, patch: { on?: boolean | null; until?: string | null }): Promise<IndoorMode> {
  const old = await readIndoor(db);
  const next: IndoorMode = { on: patch.on === undefined ? old.on : Boolean(patch.on), until: patch.until === undefined ? old.until : patch.until };
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(KEY, JSON.stringify(next))
    .run();
  return next;
}

/** Hinweis für Radeinheiten auf der Rolle. */
export const INDOOR_HINT = "Auf der Rolle (MyWhoosh, ERG-Modus): Ventilator an, Handtuch, etwa 0,75 l pro Stunde trinken.";
