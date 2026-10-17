// Datenstand je Quelle (#212): wann zuletzt abgeglichen und wie neu der jüngste Datensatz ist, damit eine
// merkwürdige Empfehlung als „alte Daten“ erkennbar wird. Reine Funktion plus eine kleine Leseabfrage.

export type FreshSource = "whoop" | "wahoo" | "mywhoosh";
export type FreshLevel = "ok" | "stale" | "none";

export interface SyncRow { last_success_at: string | null; last_attempt_at: string | null; last_error: string | null }

export interface SourceFreshness {
  source: FreshSource;
  label: string;
  /** Letzter erfolgreicher Abgleich (WHOOP, Wahoo); MyWhoosh hat keinen Abgleich, nur Uploads. */
  lastSyncAt: string | null;
  /** Ende des jüngsten Datensatzes dieser Quelle (Schlaf oder Workout). */
  lastDataAt: string | null;
  /** Stunden seit dem für die Bewertung maßgeblichen Zeitpunkt. */
  ageH: number | null;
  level: FreshLevel;
  /** Letzter Abgleich ist fehlgeschlagen. */
  error: boolean;
  text: string;
}

export interface Freshness {
  sources: SourceFreshness[];
  /** Mindestens eine verbundene Quelle ist veraltet. */
  stale: boolean;
  note: string | null;
}

/** WHOOP/Wahoo: Abgleich älter als das gilt als veraltet. */
export const SYNC_STALE_H = 24;
/** WHOOP: jüngster Schlaf/Workout älter als das gilt als veraltet (eine Nacht plus Puffer). */
export const DATA_STALE_H = 36;
/** MyWhoosh: letzte hochgeladene Fahrt älter als das wird erwähnt. */
export const UPLOAD_STALE_H = 7 * 24;

const LABEL: Record<FreshSource, string> = { whoop: "WHOOP", wahoo: "Wahoo", mywhoosh: "MyWhoosh" };

const hoursSince = (iso: string | null, now: number) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (now - t) / 3_600_000) : null;
};

/** „vor 3 Stunden“, „vor 2 Tagen“. */
export function agoText(h: number): string {
  if (h < 1) return "vor weniger als einer Stunde";
  if (h < 36) { const n = Math.round(h); return `vor ${n} ${n === 1 ? "Stunde" : "Stunden"}`; }
  const d = Math.round(h / 24);
  return `vor ${d} Tagen`;
}

export function dataFreshness(inp: { now: number; sync: Partial<Record<"whoop" | "wahoo", SyncRow | null>>; latest: Partial<Record<FreshSource, string | null>> }): Freshness {
  const sources: SourceFreshness[] = [];
  for (const source of ["whoop", "wahoo"] as const) {
    const sync = inp.sync[source] ?? null, lastDataAt = inp.latest[source] ?? null;
    const lastSyncAt = sync?.last_success_at ?? null;
    const syncH = hoursSince(lastSyncAt, inp.now), dataH = hoursSince(lastDataAt, inp.now);
    const error = !!sync?.last_error && (!lastSyncAt || (sync.last_attempt_at ?? "") > lastSyncAt);
    if (!sync && !lastDataAt) { sources.push({ source, label: LABEL[source], lastSyncAt: null, lastDataAt: null, ageH: null, level: "none", error: false, text: "nicht verbunden" }); continue; }
    // WHOOP liefert jede Nacht Schlaf; Wahoo nur, wenn gefahren wird – dort zählt nur der Abgleich.
    const stale = (syncH == null || syncH > SYNC_STALE_H || error) || (source === "whoop" && (dataH == null || dataH > DATA_STALE_H));
    const ageH = syncH ?? dataH;
    const parts = [lastSyncAt ? `abgeglichen ${agoText(syncH!)}` : "noch nie abgeglichen"];
    if (error) parts.push("letzter Abgleich fehlgeschlagen");
    if (source === "whoop" && dataH != null && dataH > DATA_STALE_H) parts.push(`neueste Daten ${agoText(dataH)}`);
    sources.push({ source, label: LABEL[source], lastSyncAt, lastDataAt, ageH: ageH == null ? null : Math.round(ageH), level: stale ? "stale" : "ok", error, text: parts.join(", ") });
  }
  const upH = hoursSince(inp.latest.mywhoosh ?? null, inp.now);
  sources.push(upH == null
    ? { source: "mywhoosh", label: LABEL.mywhoosh, lastSyncAt: null, lastDataAt: null, ageH: null, level: "none", error: false, text: "noch keine Fahrt hochgeladen" }
    : { source: "mywhoosh", label: LABEL.mywhoosh, lastSyncAt: null, lastDataAt: inp.latest.mywhoosh!, ageH: Math.round(upH), level: upH > UPLOAD_STALE_H ? "stale" : "ok", error: false, text: `letzte Fahrt ${agoText(upH)}` });

  const staleOnes = sources.filter((s) => s.level === "stale");
  // Für den Hinweis zählen nur WHOOP/Wahoo: eine Woche ohne MyWhoosh-Upload kann auch heißen, dass draußen gefahren wurde.
  const synced = staleOnes.filter((s) => s.source !== "mywhoosh");
  return {
    sources,
    stale: staleOnes.length > 0,
    note: synced.length ? `Daten von ${synced.map((s) => s.label).join(" und ")} sind nicht aktuell (${synced.map((s) => s.text).join("; ")}). Empfehlungen können darum danebenliegen.` : null,
  };
}

/** Jüngster Datensatz je Quelle: Ende des letzten Schlafs oder Workouts. */
export async function readLatestBySource(db: D1Database): Promise<Partial<Record<FreshSource, string | null>>> {
  const { results } = await db
    .prepare(
      `SELECT source, MAX(t) AS latest FROM (
         SELECT source, end_time AS t FROM sleeps UNION ALL SELECT source, end_time AS t FROM workouts
       ) GROUP BY source`,
    )
    .all<{ source: string; latest: string | null }>();
  return Object.fromEntries(results.map((r) => [r.source, r.latest]));
}
