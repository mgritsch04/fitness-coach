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
import { estimateFtp, flattenCurves, hrZoneReport, parseZones, powerCurve } from "./performance";
import { getSyncState, readDaily, readLatestBody, readPowerCurves, readSleeps, readWorkouts } from "./repository";
import { readSettings } from "./settings";
import { applyStrengthLoads, exerciseProgress, readStrengthSessions, strengthCoachNotes, weeklyVolume } from "./strength";

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

  const ftpFrom = addDays(today, -89);
  const [daily, sleeps, rawWorkouts, body, whoopSync, wahooSync, powerRows, strengthSessions] = await Promise.all([
    readDaily(db, statsFrom) as Promise<unknown> as Promise<DailyRow[]>,
    readSleeps(db, statsFrom) as Promise<unknown> as Promise<SleepRow[]>,
    readWorkouts(db, loadFrom) as Promise<unknown> as Promise<WorkoutRow[]>,
    readLatestBody(db) as Promise<{ max_hr: number | null; weight_kg: number | null; height_m: number | null } | null>,
    getSyncState(db, "whoop"),
    getSyncState(db, "wahoo"),
    readPowerCurves(db, ftpFrom).then(flattenCurves),
    readStrengthSessions(db, loadFrom),
  ]);

  // FTP-Schätzung (performance.ts) gilt nur, solange keine eigene FTP gesetzt ist.
  const ftpEstimate = estimateFtp(powerCurve(powerRows, ftpFrom), rawWorkouts, ftpFrom);
  const settings = effectiveSettings(userSettings, daily, rawWorkouts, body?.max_hr ?? null, ftpEstimate?.watts ?? null);
  // Krafteinheiten: Belastung aus Session-RPE statt Puls, Einheiten ohne Workout kommen dazu.
  const workouts = applyStrengthLoads(
    mergeWorkouts(rawWorkouts).map((w) => ({ ...w, ...workoutLoad(w, settings) })),
    strengthSessions,
  );

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
  for (const n of strengthCoachNotes(strengthSessions, today)) {
    coach.reasons.push({ factor: "strength", effect: n.effect, text: n.text });
    if (n.effect === "down" && (coach.readiness === "hard" || coach.readiness === "moderate")) coach.warnings.push(n.text);
  }
  const weeks = weeklySummaries(view, workouts, settings.sleepNeedH);
  const unestimated = workouts.filter((w) => w.day >= viewFrom && w.method === "none").length;

  return {
    generatedAt: new Date(opts.now ?? Date.now()).toISOString(),
    today,
    range: { from: viewFrom, to: today, days },
    settings,
    ftpEstimate,
    body: body ? { weightKg: body.weight_kg, heightM: body.height_m } : null,
    coach,
    trends,
    days: view,
    weeks,
    hrZones: hrZoneReport(workouts, viewFrom, today),
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
        hrZoneMin: parseZones(w.hr_zone_s)?.map((sec) => Math.round(sec / 60)) ?? null,
      })),
    notes: [
      "Belastung (TSS-Maßstab), Fitness (CTL), Ermüdung (ATL) und Form (TSB) sind Schätzungen.",
      settings.origin.ftpW === "data" ? `FTP ${settings.ftpW} W ist geschätzt (${ftpEstimate?.note ?? ""}). Trage deine FTP ein, wenn du sie kennst.` : null,
      settings.ftpW ? null : "Ohne FTP wird die Belastung aus dem Puls geschätzt. Trage deine FTP ein, sobald Leistungsdaten (Wahoo/MyWhoosh) vorliegen.",
      workouts.some((w) => w.method === "srpe") ? "Krafteinheiten zählen mit Dauer × Anstrengung (Session-RPE), geschätztes 1RM nach Epley." : null,
      unestimated ? `${unestimated} Workouts ohne Puls oder Leistung zählen nicht zur Trainingslast.` : null,
    ].filter(Boolean),
    strength: {
      sessions: strengthSessions
        .filter((x) => x.day >= viewFrom)
        .map((x) => ({ id: x.id, day: x.day, name: x.name, durationMin: x.durationMin, rpe: x.rpe, sets: x.sets.length, exercises: [...new Set(x.sets.map((y) => y.exerciseName))] })),
      weeks: weeklyVolume(strengthSessions.filter((x) => x.day >= viewFrom)),
      progress: exerciseProgress(strengthSessions, today).map(({ history, ...p }) => ({ ...p, history: history.slice(-12) })),
    },
    sync: { whoop: whoopSync, wahoo: wahooSync },
  };
}
