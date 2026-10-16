// Lesen und Schreiben des gemeinsamen Datenmodells in D1.
import type { BodyMeasurement, Daily, Recovery, Sleep, Source, Workout, WorkoutStream } from "./model";

export function upsertDaily(db: D1Database, d: Daily): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO daily (source, source_id, day, start_time, end_time, strain, energy_kj, avg_hr, max_hr, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (source, source_id) DO UPDATE SET day = excluded.day, start_time = excluded.start_time,
         end_time = excluded.end_time, strain = excluded.strain, energy_kj = excluded.energy_kj,
         avg_hr = excluded.avg_hr, max_hr = excluded.max_hr, updated_at = excluded.updated_at`,
    )
    .bind(d.source, d.sourceId, d.day, d.startTime, d.endTime, d.strain, d.energyKj, d.avgHr, d.maxHr);
}

/** Erholung gehört zu einem Tag; fehlt der Tag noch, passiert nichts (kommt beim nächsten Abgleich). */
export function updateRecovery(db: D1Database, r: Recovery): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE daily SET recovery_score = ?, resting_hr = ?, hrv_ms = ?, spo2_pct = ?, skin_temp_c = ?, updated_at = datetime('now')
       WHERE source = ? AND source_id = ?`,
    )
    .bind(r.recoveryScore, r.restingHr, r.hrvMs, r.spo2Pct, r.skinTempC, r.source, r.dailySourceId);
}

export function upsertSleep(db: D1Database, s: Sleep): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO sleeps (source, source_id, day, start_time, end_time, is_nap, in_bed_s, asleep_s, awake_s, light_s, deep_s, rem_s,
         performance_pct, efficiency_pct, consistency_pct, respiratory_rate, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (source, source_id) DO UPDATE SET day = excluded.day, start_time = excluded.start_time, end_time = excluded.end_time,
         is_nap = excluded.is_nap, in_bed_s = excluded.in_bed_s, asleep_s = excluded.asleep_s, awake_s = excluded.awake_s,
         light_s = excluded.light_s, deep_s = excluded.deep_s, rem_s = excluded.rem_s, performance_pct = excluded.performance_pct,
         efficiency_pct = excluded.efficiency_pct, consistency_pct = excluded.consistency_pct,
         respiratory_rate = excluded.respiratory_rate, updated_at = excluded.updated_at`,
    )
    .bind(
      s.source, s.sourceId, s.day, s.startTime, s.endTime, s.isNap ? 1 : 0, s.inBedS, s.asleepS, s.awakeS, s.lightS, s.deepS, s.remS,
      s.performancePct, s.efficiencyPct, s.consistencyPct, s.respiratoryRate,
    );
}

export function upsertWorkout(db: D1Database, w: Workout): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO workouts (source, source_id, day, start_time, end_time, sport, duration_s, distance_m, energy_kj, avg_hr, max_hr,
         avg_power_w, normalized_power_w, strain, avg_cadence_rpm, tss, hr_zone_s, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (source, source_id) DO UPDATE SET day = excluded.day, start_time = excluded.start_time, end_time = excluded.end_time,
         sport = excluded.sport, duration_s = excluded.duration_s, distance_m = excluded.distance_m, energy_kj = excluded.energy_kj,
         avg_hr = excluded.avg_hr, max_hr = excluded.max_hr, avg_power_w = excluded.avg_power_w,
         normalized_power_w = excluded.normalized_power_w, strain = excluded.strain, avg_cadence_rpm = excluded.avg_cadence_rpm,
         tss = excluded.tss, hr_zone_s = COALESCE(excluded.hr_zone_s, workouts.hr_zone_s), updated_at = excluded.updated_at`,
    )
    .bind(
      w.source, w.sourceId, w.day, w.startTime, w.endTime, w.sport, w.durationS, w.distanceM, w.energyKj, w.avgHr, w.maxHr,
      w.avgPowerW, w.normalizedPowerW, w.strain, w.avgCadenceRpm ?? null, w.tss ?? null, w.hrZoneS ? JSON.stringify(w.hrZoneS) : null,
    );
}

/** Sekundenreihen als JSON; ein erneuter Import ersetzt sie. */
export function upsertWorkoutStream(db: D1Database, s: WorkoutStream): D1PreparedStatement {
  const j = (v: unknown) => (v == null ? null : JSON.stringify(v));
  return db
    .prepare(
      `INSERT INTO workout_streams (source, source_id, start_time, interval_s, power, heart_rate, cadence, power_curve, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (source, source_id) DO UPDATE SET start_time = excluded.start_time, power = excluded.power,
         heart_rate = excluded.heart_rate, cadence = excluded.cadence, power_curve = excluded.power_curve, updated_at = excluded.updated_at`,
    )
    .bind(s.source, s.sourceId, s.startTime, j(s.power), j(s.heartRate), j(s.cadence), j(s.powerCurve));
}

export function upsertBody(db: D1Database, b: BodyMeasurement): D1PreparedStatement {
  return db
    .prepare("INSERT OR REPLACE INTO body_measurements (source, measured_at, height_m, weight_kg, max_hr) VALUES (?, ?, ?, ?, ?)")
    .bind(b.source, b.measuredAt, b.heightM, b.weightKg, b.maxHr);
}

/** Für Löschmeldungen der Anbieter (z. B. WHOOP-Webhook „workout.deleted“). */
export function deleteWorkout(db: D1Database, source: Source, sourceId: string): D1PreparedStatement {
  return db.prepare("DELETE FROM workouts WHERE source = ? AND source_id = ?").bind(source, sourceId);
}

export function deleteSleep(db: D1Database, source: Source, sourceId: string): D1PreparedStatement {
  return db.prepare("DELETE FROM sleeps WHERE source = ? AND source_id = ?").bind(source, sourceId);
}

/** D1 nimmt höchstens 100 Anweisungen pro Batch an. */
export async function runBatched(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < statements.length; i += 100) await db.batch(statements.slice(i, i + 100));
}

export async function getSyncState(db: D1Database, source: Source) {
  return db
    .prepare("SELECT last_success_at, last_attempt_at, last_error FROM sync_state WHERE source = ?")
    .bind(source)
    .first<{ last_success_at: string | null; last_attempt_at: string | null; last_error: string | null }>();
}

export async function setSyncState(db: D1Database, source: Source, ok: boolean, error: string | null, at: string) {
  await db
    .prepare(
      `INSERT INTO sync_state (source, last_success_at, last_attempt_at, last_error) VALUES (?, ?, ?, ?)
       ON CONFLICT (source) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_error = excluded.last_error,
         last_success_at = COALESCE(excluded.last_success_at, sync_state.last_success_at)`,
    )
    .bind(source, ok ? at : null, at, error)
    .run();
}

// --- Lesen für Connector und Dashboard -------------------------------------------------------

export async function readDaily(db: D1Database, fromDay: string) {
  const { results } = await db
    .prepare(
      `SELECT day, source, strain, energy_kj, avg_hr, max_hr, recovery_score, resting_hr, hrv_ms, spo2_pct, skin_temp_c
       FROM daily WHERE day >= ? ORDER BY day DESC`,
    )
    .bind(fromDay)
    .all();
  return results;
}

export async function readSleeps(db: D1Database, fromDay: string) {
  const { results } = await db
    .prepare(
      `SELECT day, source, start_time, end_time, is_nap, in_bed_s, asleep_s, awake_s, light_s, deep_s, rem_s,
         performance_pct, efficiency_pct, consistency_pct, respiratory_rate
       FROM sleeps WHERE day >= ? ORDER BY start_time DESC`,
    )
    .bind(fromDay)
    .all();
  return results;
}

export async function readWorkouts(db: D1Database, fromDay: string) {
  const { results } = await db
    .prepare(
      `SELECT day, source, source_id, start_time, end_time, sport, duration_s, distance_m, energy_kj, avg_hr, max_hr,
         avg_power_w, normalized_power_w, strain, avg_cadence_rpm, tss, hr_zone_s
       FROM workouts WHERE day >= ? ORDER BY start_time DESC`,
    )
    .bind(fromDay)
    .all();
  return results;
}

export async function readLatestBody(db: D1Database) {
  return db.prepare("SELECT source, measured_at, height_m, weight_kg, max_hr FROM body_measurements ORDER BY measured_at DESC LIMIT 1").first();
}

/** Bestleistungskurven aller Workouts mit Leistungsdaten ab `fromDay`, neueste zuerst. */
export async function readPowerCurves(db: D1Database, fromDay: string) {
  const { results } = await db
    .prepare(
      `SELECT w.day, w.source, w.source_id, w.start_time, s.power_curve FROM workout_streams s
       JOIN workouts w ON w.source = s.source AND w.source_id = s.source_id
       WHERE w.day >= ? AND s.power_curve IS NOT NULL ORDER BY w.start_time DESC`,
    )
    .bind(fromDay)
    .all<{ day: string; source: string; source_id: string; start_time: string; power_curve: string }>();
  return results.map((r) => ({ ...r, power_curve: JSON.parse(r.power_curve) as Record<string, number> }));
}

/** Sekundenreihen eines Workouts (für Detailansichten und eigene Auswertungen). */
export async function readWorkoutStream(db: D1Database, source: string, sourceId: string) {
  const r = await db
    .prepare("SELECT source, source_id, start_time, interval_s, power, heart_rate, cadence, power_curve FROM workout_streams WHERE source = ? AND source_id = ?")
    .bind(source, sourceId)
    .first<Record<string, string | number | null>>();
  if (!r) return null;
  const p = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : null);
  return { ...r, power: p(r.power), heart_rate: p(r.heart_rate), cadence: p(r.cadence), power_curve: p(r.power_curve) };
}
