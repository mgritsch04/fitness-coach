// Übersetzt Wahoo-Cloud-API-Workouts ins gemeinsame Datenmodell.
import type { Workout } from "../../core/model";

/** Rohform laut Wahoo-Doku. Zahlen kommen teils als Strings, Felder können fehlen. */
export interface WahooWorkoutRaw {
  id: number;
  starts: string;
  minutes?: number | string | null;
  name?: string | null;
  workout_type_id?: number | null;
  created_at?: string;
  updated_at?: string;
  workout_summary?: {
    ascent_accum?: number | string | null;
    cadence_avg?: number | string | null;
    calories_accum?: number | string | null;
    distance_accum?: number | string | null;
    duration_active_accum?: number | string | null;
    duration_total_accum?: number | string | null;
    heart_rate_avg?: number | string | null;
    power_avg?: number | string | null;
    power_bike_np_last?: number | string | null;
    power_bike_tss_last?: number | string | null;
    speed_avg?: number | string | null;
    work_accum?: number | string | null;
    time_zone?: string | null;
    file?: { url?: string | null } | null;
  } | null;
}

/** Wahoo-Workout-Typen (Auszug, aus der Doku-Liste übernommen, nicht vollständig geprüft); Rest bleibt leer. */
const WORKOUT_TYPES: Record<number, string> = {
  0: "cycling", 11: "cycling", 12: "cycling", 13: "cycling", 14: "cycling", 15: "cycling", 16: "cycling", 21: "cycling",
  1: "running", 3: "running", 4: "running", 5: "running",
  6: "walking", 7: "walking", 8: "walking", 9: "hiking",
  22: "rowing",
  25: "swimming", 26: "swimming",
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Lokales Datum über die Zeitzone des Workouts (falls Wahoo sie liefert), sonst UTC. */
export function wahooDay(isoUtc: string, timeZone: string | null | undefined): string {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(isoUtc));
    } catch {
      // unbekannte Zeitzone: UTC
    }
  }
  return new Date(isoUtc).toISOString().slice(0, 10);
}

const KJ_PER_KCAL = 4.184;

export function mapWorkout(w: WahooWorkoutRaw): Workout {
  const s = w.workout_summary ?? {};
  const minutes = num(w.minutes);
  const durationS = Math.round(num(s.duration_total_accum) ?? (minutes ?? 0) * 60);
  const startTime = new Date(w.starts).toISOString();
  const kcal = num(s.calories_accum);
  const hr = num(s.heart_rate_avg);
  return {
    source: "wahoo",
    sourceId: String(w.id),
    day: wahooDay(startTime, s.time_zone),
    startTime,
    endTime: new Date(Date.parse(startTime) + durationS * 1000).toISOString(),
    sport: (w.workout_type_id != null && WORKOUT_TYPES[w.workout_type_id]) || null,
    durationS,
    distanceM: num(s.distance_accum),
    // Wie bei WHOOP: verbrauchte Energie (kcal → kJ), nicht die mechanische Arbeit.
    energyKj: kcal != null ? Math.round(kcal * KJ_PER_KCAL) : null,
    avgHr: hr != null ? Math.round(hr) : null,
    maxHr: null,
    avgPowerW: num(s.power_avg),
    normalizedPowerW: num(s.power_bike_np_last),
    strain: null,
  };
}
