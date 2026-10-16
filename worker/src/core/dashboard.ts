// Stellt alles zusammen, was das Dashboard braucht – in einem Aufruf, damit das Artefakt nur
// ein Werkzeug abfragen muss.
import {
  addDays,
  daySeries,
  effectiveSettings,
  mergeWorkouts,
  todayIn,
  trainingLoad,
  trend,
  weeklySummaries,
  workoutLoad,
  type DailyRow,
  type SleepRow,
  type WorkoutRow,
} from "./analysis";
import { coachAdvice } from "./coach";
import { getSyncState, readDaily, readLatestBody, readSleeps, readWorkouts } from "./repository";
import { readSettings } from "./settings";

/** Vorlauf, damit die 42-Tage-Fitness (CTL) am Anfang der Ansicht schon eingeschwungen ist. */
const LOAD_WARMUP_DAYS = 120;
/** Vorlauf für die persönliche Basis der Trends. */
const BASELINE_DAYS = 35;

export async function buildDashboard(db: D1Database, opts: { days?: number; now?: number } = {}) {
  const days = Math.min(365, Math.max(7, opts.days ?? 90));
  const userSettings = await readSettings(db);
  const today = todayIn(userSettings.timezone ?? "Europe/Berlin", opts.now);
  const viewFrom = addDays(today, -(days - 1));
  const loadFrom = addDays(viewFrom, -LOAD_WARMUP_DAYS);
  const statsFrom = addDays(viewFrom, -BASELINE_DAYS);

  const [daily, sleeps, rawWorkouts, body, whoopSync, wahooSync] = await Promise.all([
    readDaily(db, statsFrom) as Promise<unknown> as Promise<DailyRow[]>,
    readSleeps(db, statsFrom) as Promise<unknown> as Promise<SleepRow[]>,
    readWorkouts(db, loadFrom) as Promise<unknown> as Promise<WorkoutRow[]>,
    readLatestBody(db) as Promise<{ max_hr: number | null; weight_kg: number | null; height_m: number | null } | null>,
    getSyncState(db, "whoop"),
    getSyncState(db, "wahoo"),
  ]);

  const settings = effectiveSettings(userSettings, daily, rawWorkouts, body?.max_hr ?? null);
  const workouts = mergeWorkouts(rawWorkouts).map((w) => ({ ...w, ...workoutLoad(w, settings) }));

  const loadsByDay = new Map<string, number>();
  for (const w of workouts) if (w.load != null) loadsByDay.set(w.day, (loadsByDay.get(w.day) ?? 0) + w.load);
  // Ab dem ersten Workout (höchstens LOAD_WARMUP_DAYS vor der Ansicht) aufsummieren.
  const firstDay = [...loadsByDay.keys()].sort()[0] ?? statsFrom;
  const load = trainingLoad(loadsByDay, firstDay < statsFrom ? firstDay : statsFrom, today);

  const series = daySeries(daily, sleeps, workouts, load, statsFrom, today);
  const trends = {
    recovery: trend(series, "recovery", today),
    hrv: trend(series, "hrv", today),
    rhr: trend(series, "rhr", today),
    sleepH: trend(series, "sleepH", today),
    strain: trend(series, "strain", today),
    respRate: trend(series, "respRate", today),
  };
  const view = series.filter((p) => p.day >= viewFrom);
  const coach = coachAdvice(series, today, trends, settings.sleepNeedH);
  const weeks = weeklySummaries(view, workouts, settings.sleepNeedH);
  const unestimated = workouts.filter((w) => w.day >= viewFrom && w.method === "none").length;

  return {
    generatedAt: new Date(opts.now ?? Date.now()).toISOString(),
    today,
    range: { from: viewFrom, to: today, days },
    settings,
    body: body ? { weightKg: body.weight_kg, heightM: body.height_m } : null,
    coach,
    trends,
    days: view,
    weeks,
    workouts: workouts
      .filter((w) => w.day >= viewFrom)
      .map((w) => ({
        day: w.day,
        start: w.start_time,
        sport: w.sport,
        sources: w.sources,
        durationMin: Math.round((w.duration_s ?? 0) / 60),
        distanceKm: w.distance_m != null ? Number((w.distance_m / 1000).toFixed(2)) : null,
        energyKj: w.energy_kj != null ? Math.round(w.energy_kj) : null,
        avgHr: w.avg_hr,
        maxHr: w.max_hr,
        avgPowerW: w.avg_power_w,
        normalizedPowerW: w.normalized_power_w,
        strain: w.strain != null ? Number(w.strain.toFixed(1)) : null,
        load: w.load,
        loadMethod: w.method,
        intensity: w.intensity,
      })),
    notes: [
      "Belastung (TSS-Maßstab), Fitness (CTL), Ermüdung (ATL) und Form (TSB) sind Schätzungen.",
      settings.ftpW ? null : "Ohne FTP wird die Belastung aus dem Puls geschätzt. Trage deine FTP ein, sobald Leistungsdaten (Wahoo/MyWhoosh) vorliegen.",
      unestimated ? `${unestimated} Workouts ohne Puls oder Leistung zählen nicht zur Trainingslast.` : null,
    ].filter(Boolean),
    sync: { whoop: whoopSync, wahoo: wahooSync },
  };
}
