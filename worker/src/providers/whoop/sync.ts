// Abgleich WHOOP → gemeinsames Datenmodell. Erstabgleich: letzte 30 Tage. Danach ab dem letzten
// erfolgreichen Abgleich minus 3 Tage, weil WHOOP Scores (Schlaf, Recovery) nachträglich anpasst.
import {
  getSyncState,
  runBatched,
  setSyncState,
  updateRecovery,
  upsertBody,
  upsertDaily,
  upsertSleep,
  upsertWorkout,
} from "../../core/repository";
import { validAccessToken, whoopGet, type WhoopCredentials, type WhoopTokenStore } from "./client";
import { mapBody, mapCycle, mapRecovery, mapSleep, mapWorkout, type WhoopBody, type WhoopCycle, type WhoopRecovery, type WhoopSleep, type WhoopWorkout } from "./map";

const DAY = 86_400_000;
const INITIAL_DAYS = 30;
const OVERLAP_DAYS = 3;

interface Page<T> {
  records: T[];
  next_token?: string | null;
}

type Fetch = typeof fetch;

export async function fetchAll<T>(token: string, path: string, start: string, end: string, f: Fetch = fetch): Promise<T[]> {
  const all: T[] = [];
  let next: string | null | undefined;
  for (let page = 0; page < 40; page++) {
    const q = new URLSearchParams({ limit: "25", start, end });
    if (next) q.set("nextToken", next);
    const res = await whoopGet<Page<T>>(token, `${path}?${q}`, f);
    all.push(...res.records);
    next = res.next_token;
    if (!next) break;
  }
  return all;
}

export function syncWindow(lastSuccessAt: string | null | undefined, now: number) {
  const startMs = lastSuccessAt ? Date.parse(lastSuccessAt) - OVERLAP_DAYS * DAY : now - INITIAL_DAYS * DAY;
  return { start: new Date(Math.max(startMs, now - 365 * DAY)).toISOString(), end: new Date(now).toISOString() };
}

export interface SyncResult {
  days: number;
  sleeps: number;
  workouts: number;
  window: { start: string; end: string };
}

export async function syncWhoop(
  db: D1Database,
  creds: WhoopCredentials,
  store: WhoopTokenStore,
  userId: string,
  opts: { now?: number; full?: boolean; fetch?: Fetch } = {},
): Promise<SyncResult> {
  const now = opts.now ?? Date.now();
  const f = opts.fetch ?? fetch;
  const at = new Date(now).toISOString();
  const state = opts.full ? null : await getSyncState(db, "whoop");
  const window = syncWindow(state?.last_success_at, now);
  try {
    const token = await validAccessToken(creds, store, userId, f, now);
    // Zyklen zuerst: Recovery wird an den Tag des Zyklus gehängt.
    const cycles = await fetchAll<WhoopCycle>(token, "/v2/cycle", window.start, window.end, f);
    const recoveries = await fetchAll<WhoopRecovery>(token, "/v2/recovery", window.start, window.end, f);
    const sleeps = await fetchAll<WhoopSleep>(token, "/v2/activity/sleep", window.start, window.end, f);
    const workouts = await fetchAll<WhoopWorkout>(token, "/v2/activity/workout", window.start, window.end, f);
    const body = await whoopGet<WhoopBody>(token, "/v2/user/measurement/body", f);

    await runBatched(db, [
      ...cycles.map((c) => upsertDaily(db, mapCycle(c))),
      ...recoveries.map((r) => updateRecovery(db, mapRecovery(r))),
      ...sleeps.map((s) => upsertSleep(db, mapSleep(s))),
      ...workouts.map((w) => upsertWorkout(db, mapWorkout(w))),
      upsertBody(db, mapBody(body, at.slice(0, 10))),
    ]);
    await setSyncState(db, "whoop", true, null, at);
    return { days: cycles.length, sleeps: sleeps.length, workouts: workouts.length, window };
  } catch (err) {
    await setSyncState(db, "whoop", false, err instanceof Error ? err.message : String(err), at);
    throw err;
  }
}
