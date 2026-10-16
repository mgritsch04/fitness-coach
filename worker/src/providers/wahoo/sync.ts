// Abgleich Wahoo → gemeinsames Datenmodell. Wahoo liefert Workouts seitenweise, neueste zuerst.
// Erstabgleich: letzte 30 Tage, danach ab dem letzten Erfolg minus 3 Tage (Zusammenfassungen kommen
// teils verzögert). Die Sandbox erlaubt nur wenige Anfragen (laut Drittquellen 25 je 5 Minuten),
// daher höchstens 5 Seiten pro Lauf.
import { getSyncState, runBatched, setSyncState, upsertWorkout } from "../../core/repository";
import { listWorkouts, validAccessToken, type WahooCredentials, type WahooTokenStore } from "./client";
import { mapWorkout } from "./map";

const DAY = 86_400_000;
const INITIAL_DAYS = 30;
const OVERLAP_DAYS = 3;
const PER_PAGE = 30;
const MAX_PAGES = 5;

type Fetch = typeof fetch;

export interface WahooSyncResult {
  workouts: number;
  since: string;
}

export async function syncWahoo(
  db: D1Database,
  creds: WahooCredentials,
  store: WahooTokenStore,
  ownerId: string,
  opts: { now?: number; full?: boolean; days?: number; fetch?: Fetch } = {},
): Promise<WahooSyncResult> {
  const now = opts.now ?? Date.now();
  const f = opts.fetch ?? fetch;
  const at = new Date(now).toISOString();
  const state = opts.full ? null : await getSyncState(db, "wahoo");
  const sinceMs = state?.last_success_at ? Date.parse(state.last_success_at) - OVERLAP_DAYS * DAY : now - (opts.days ?? INITIAL_DAYS) * DAY;
  try {
    const token = await validAccessToken(creds, store, ownerId, f, now);
    const workouts = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await listWorkouts(token, page, PER_PAGE, f);
      const recent = res.workouts.filter((w) => Date.parse(w.starts) >= sinceMs);
      workouts.push(...recent);
      if (res.workouts.length < PER_PAGE || recent.length < res.workouts.length) break;
    }
    await runBatched(db, workouts.map((w) => upsertWorkout(db, mapWorkout(w))));
    await setSyncState(db, "wahoo", true, null, at);
    return { workouts: workouts.length, since: new Date(sinceMs).toISOString() };
  } catch (err) {
    await setSyncState(db, "wahoo", false, err instanceof Error ? err.message : String(err), at);
    throw err;
  }
}
