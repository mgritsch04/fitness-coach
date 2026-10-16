// Übersetzt WHOOP-API-v2-Antworten ins gemeinsame Datenmodell. Werte ohne Score
// (score_state ≠ SCORED) bleiben leer statt 0, damit Auswertungen sie ignorieren.
import { localDay, type BodyMeasurement, type Daily, type Recovery, type Sleep, type Workout } from "../../core/model";

export interface WhoopCycle {
  id: number;
  start: string;
  end?: string | null;
  timezone_offset?: string;
  score_state: string;
  score?: { strain?: number; kilojoule?: number; average_heart_rate?: number; max_heart_rate?: number };
}

export interface WhoopRecovery {
  cycle_id: number;
  score_state: string;
  score?: { recovery_score?: number; resting_heart_rate?: number; hrv_rmssd_milli?: number; spo2_percentage?: number; skin_temp_celsius?: number };
}

export interface WhoopSleep {
  id: string;
  start: string;
  end: string;
  timezone_offset?: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_consistency_percentage?: number;
    sleep_efficiency_percentage?: number;
  };
}

export interface WhoopWorkout {
  id: string;
  start: string;
  end: string;
  timezone_offset?: string;
  sport_name?: string;
  score_state: string;
  score?: { strain?: number; average_heart_rate?: number; max_heart_rate?: number; kilojoule?: number; distance_meter?: number };
}

export interface WhoopBody {
  height_meter?: number;
  weight_kilogram?: number;
  max_heart_rate?: number;
}

const scored = (s: string) => s === "SCORED";
const sec = (ms: number | undefined) => (ms == null ? null : Math.round(ms / 1000));
const n = <T>(v: T | undefined) => (v === undefined ? null : v);

export function mapCycle(c: WhoopCycle): Daily {
  const s = scored(c.score_state) ? c.score : undefined;
  return {
    source: "whoop",
    sourceId: String(c.id),
    day: localDay(c.start, c.timezone_offset),
    startTime: c.start,
    endTime: c.end ?? null,
    strain: n(s?.strain),
    energyKj: n(s?.kilojoule),
    avgHr: n(s?.average_heart_rate),
    maxHr: n(s?.max_heart_rate),
  };
}

export function mapRecovery(r: WhoopRecovery): Recovery {
  const s = scored(r.score_state) ? r.score : undefined;
  return {
    source: "whoop",
    dailySourceId: String(r.cycle_id),
    recoveryScore: n(s?.recovery_score),
    restingHr: n(s?.resting_heart_rate),
    hrvMs: n(s?.hrv_rmssd_milli),
    spo2Pct: n(s?.spo2_percentage),
    skinTempC: n(s?.skin_temp_celsius),
  };
}

export function mapSleep(x: WhoopSleep): Sleep {
  const s = scored(x.score_state) ? x.score : undefined;
  const st = s?.stage_summary;
  const light = sec(st?.total_light_sleep_time_milli);
  const deep = sec(st?.total_slow_wave_sleep_time_milli);
  const rem = sec(st?.total_rem_sleep_time_milli);
  return {
    source: "whoop",
    sourceId: x.id,
    // Eine Nacht zählt zum Tag, an dem man aufwacht.
    day: localDay(x.end, x.timezone_offset),
    startTime: x.start,
    endTime: x.end,
    isNap: x.nap,
    inBedS: sec(st?.total_in_bed_time_milli),
    asleepS: light != null && deep != null && rem != null ? light + deep + rem : null,
    awakeS: sec(st?.total_awake_time_milli),
    lightS: light,
    deepS: deep,
    remS: rem,
    performancePct: n(s?.sleep_performance_percentage),
    efficiencyPct: n(s?.sleep_efficiency_percentage),
    consistencyPct: n(s?.sleep_consistency_percentage),
    respiratoryRate: n(s?.respiratory_rate),
  };
}

export function mapWorkout(w: WhoopWorkout): Workout {
  const s = scored(w.score_state) ? w.score : undefined;
  return {
    source: "whoop",
    sourceId: w.id,
    day: localDay(w.start, w.timezone_offset),
    startTime: w.start,
    endTime: w.end,
    sport: w.sport_name ?? null,
    durationS: Math.round((Date.parse(w.end) - Date.parse(w.start)) / 1000),
    distanceM: n(s?.distance_meter),
    energyKj: n(s?.kilojoule),
    avgHr: n(s?.average_heart_rate),
    maxHr: n(s?.max_heart_rate),
    avgPowerW: null,
    normalizedPowerW: null,
    strain: n(s?.strain),
  };
}

export function mapBody(b: WhoopBody, measuredAt: string): BodyMeasurement {
  return { source: "whoop", measuredAt, heightM: n(b.height_meter), weightKg: n(b.weight_kilogram), maxHr: n(b.max_heart_rate) };
}
