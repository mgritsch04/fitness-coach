// Import einer hochgeladenen MyWhoosh-FIT-Datei in D1.
import { isSameSession, DEFAULT_TIMEZONE, type WorkoutRow } from "../../core/analysis";
import { readWorkouts, runBatched, upsertWorkout, upsertWorkoutStream } from "../../core/repository";
import { readSettings } from "../../core/settings";
import { FitError } from "./fit";
import { mapFit } from "./map";

/** Obergrenze für eine FIT-Datei (eine lange Fahrt mit Sekundenwerten hat meist unter 2 MB). */
export const MAX_FIT_BYTES = 8 * 1024 * 1024;

export class FitImportError extends Error {}

export function decodeBase64(b64: string): Uint8Array {
  // Erlaubt auch Data-URLs („data:…;base64,…“), wie sie FileReader.readAsDataURL liefert.
  const clean = b64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(clean)) throw new FitImportError("Datei ist nicht als Base64 kodiert.");
  const bin = atob(clean.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function importFit(db: D1Database, fileBase64: string) {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(fileBase64);
  } catch (err) {
    throw err instanceof FitImportError ? err : new FitImportError("Datei ist nicht als Base64 kodiert.");
  }
  if (bytes.length > MAX_FIT_BYTES) throw new FitImportError("Datei ist größer als 8 MB, das ist für eine FIT-Datei ungewöhnlich.");

  const settings = await readSettings(db);
  let parsed;
  try {
    parsed = mapFit(bytes, settings.timezone ?? DEFAULT_TIMEZONE);
  } catch (err) {
    if (err instanceof FitError) throw new FitImportError(err.message);
    throw err;
  }
  const { workout, stream } = parsed;

  // Ab Vortag lesen, damit auch Fahrten über Mitternacht gefunden werden.
  const fromDay = new Date(Date.parse(workout.day) - 86_400_000).toISOString().slice(0, 10);
  const existing = (await readWorkouts(db, fromDay)) as unknown as WorkoutRow[];
  const alreadyImported = existing.some((w) => w.source === "mywhoosh" && w.source_id === workout.sourceId);
  const row: WorkoutRow = {
    day: workout.day, source: workout.source, source_id: workout.sourceId, start_time: workout.startTime, end_time: workout.endTime,
    sport: workout.sport, duration_s: workout.durationS, distance_m: workout.distanceM, energy_kj: workout.energyKj,
    avg_hr: workout.avgHr, max_hr: workout.maxHr, avg_power_w: workout.avgPowerW, normalized_power_w: workout.normalizedPowerW,
    strain: workout.strain,
  };
  // Dieselbe Fahrt aus anderen Quellen (z. B. WHOOP-Puls) bleibt gespeichert und wird beim Auslesen zusammengeführt.
  const sameRideIn = [...new Set(existing.filter((w) => isSameSession(w, row)).map((w) => w.source))];

  await runBatched(db, stream ? [upsertWorkout(db, workout), upsertWorkoutStream(db, stream)] : [upsertWorkout(db, workout)]);
  return {
    imported: true,
    updated: alreadyImported,
    workout: {
      sourceId: workout.sourceId,
      day: workout.day,
      startTime: workout.startTime,
      sport: workout.sport,
      durationS: workout.durationS,
      distanceM: workout.distanceM,
      avgPowerW: workout.avgPowerW,
      normalizedPowerW: workout.normalizedPowerW,
      avgHr: workout.avgHr,
      maxHr: workout.maxHr,
      avgCadenceRpm: workout.avgCadenceRpm,
      tss: workout.tss,
    },
    secondsOfData: stream ? Math.max(stream.power?.length ?? 0, stream.heartRate?.length ?? 0, stream.cadence?.length ?? 0) : 0,
    powerCurve: stream?.powerCurve ?? null,
    sameRideIn,
  };
}
