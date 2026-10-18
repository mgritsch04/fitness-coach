// Stellt alles zusammen, was das Dashboard braucht – in einem Aufruf, damit das Artefakt nur
// ein Werkzeug abfragen muss.
import { dataFreshness, readLatestBySource } from "./freshness";
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
  type DayPoint,
  type SleepRow,
  type WorkoutRow,
} from "./analysis";
import { coachAdvice } from "./coach";
import { restRideAdvice } from "./rest-ride";
import { INDOOR_HINT, indoorState, readIndoor } from "./indoor";
import { trainingOverview } from "./training";
import { zoneTargets } from "./zone-targets";
import { applyFeedback, feedbackAdjust, readFeedback } from "./feedback";
import { applyJournal, readJournal, readRpe, sessionRpe, tagEffects } from "./journal";
import { applyWarning } from "./warning-cap";
import { applyHrvTrend } from "./hrv-cap";
import { hrvTrend } from "./hrv-trend";
import { applyReturn, returnToTraining } from "./return-to-training";
import { sleepReport } from "./sleep";
import { sleepTarget } from "./sleep-need";
import { earlyWarning } from "./warnings";
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
  const [userSettings, indoorMode] = await Promise.all([readSettings(db), readIndoor(db).catch(() => ({ on: false, until: null }))]);
  const today = todayIn(userSettings.timezone ?? "Europe/Berlin", opts.now);
  const viewFrom = addDays(today, -(days - 1));
  const loadFrom = addDays(viewFrom, -LOAD_WARMUP_DAYS);
  const statsFrom = addDays(viewFrom, -BASELINE_DAYS);
  // HRV-Trend (hrv-trend.ts) braucht 60 Tage Basis + 7 Tage Mittel, unabhängig von der Ansicht.
  const hrvFrom = [statsFrom, addDays(today, -70)].sort()[0];

  const ftpFrom = addDays(today, -89);
  const [dailyAll, sleeps, rawWorkouts, body, whoopSync, wahooSync, powerRows, strengthSessions] = await Promise.all([
    readDaily(db, hrvFrom) as Promise<unknown> as Promise<DailyRow[]>,
    readSleeps(db, statsFrom) as Promise<unknown> as Promise<SleepRow[]>,
    readWorkouts(db, loadFrom) as Promise<unknown> as Promise<WorkoutRow[]>,
    readLatestBody(db) as Promise<{ max_hr: number | null; weight_kg: number | null; height_m: number | null } | null>,
    getSyncState(db, "whoop"),
    getSyncState(db, "wahoo"),
    readPowerCurves(db, ftpFrom).then(flattenCurves),
    readStrengthSessions(db, loadFrom),
  ]);

  const daily = dailyAll.filter((d) => d.day >= statsFrom);
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
  const baseCoach = coachAdvice(series, today, trends, settings.sleepNeedH);
  for (const n of strengthCoachNotes(strengthSessions, today)) {
    baseCoach.reasons.push({ factor: "strength", effect: n.effect, text: n.text });
    if (n.effect === "down" && (baseCoach.readiness === "hard" || baseCoach.readiness === "moderate")) baseCoach.warnings.push(n.text);
  }
  // Tagebuch (journal.ts): Check-in von heute fließt in die Tagesempfehlung ein.
  const [journal, rpeRows, feedback] = await Promise.all([readJournal(db, statsFrom, today), readRpe(db, viewFrom), readFeedback(db, addDays(today, -30)).catch(() => [])]);
  // Rückmeldung zur Tagesempfehlung (feedback.ts, #216): begrenzte Korrektur aus den letzten 30 Tagen.
  const fbAdjust = feedbackAdjust(feedback, today);
  const journalToday = journal.find((j) => j.day === today) ?? null;
  // Frühwarnung (warnings.ts): mehrere Körpersignale außerhalb der Basis dämpfen die Empfehlung.
  const warning = earlyWarning(series, today);
  // Je Tag ein HRV-Wert (mehrere Quellen: der vorhandene gewinnt).
  const hrvByDay = new Map<string, number>();
  for (const d of dailyAll) if (d.hrv_ms != null && !hrvByDay.has(d.day)) hrvByDay.set(d.day, d.hrv_ms);
  const hrv = hrvTrend([...hrvByDay].map(([day, v]) => ({ day, hrv: v }) as DayPoint), today, 14);
  const hrvSignal = hrv.available ? { pattern: hrv.pattern, label: hrv.label, advice: hrv.advice } : null;
  // Wiedereinstieg nach Krankheit oder Pause (return-to-training.ts, #201): deckelt die Empfehlung stufenweise.
  const comeback = returnToTraining(series, journal, today);
  const coach = applyReturn(applyFeedback(applyJournal(applyHrvTrend(applyWarning(baseCoach, warning), hrvSignal), journalToday), fbAdjust), comeback);
  // Winterbetrieb (#326): Einheiten auf der Rolle.
  const indoor = indoorState(indoorMode, today);
  if (indoor.active && coach.readiness !== "rest") coach.suggestion = `${coach.suggestion} ${INDOOR_HINT}`;
  // Ruhetag (#324): locker ausfahren ja oder nein, nach allen Deckeln oben.
  coach.restRide = restRideAdvice({ coach, series, today, rhrTrend: trends.rhr, sleepNeedH: settings.sleepNeedH, warning, comeback, journalToday, indoor: indoor.active });
  const rpeBy = new Map(rpeRows.map((r) => [`${r.source}:${r.sourceId}`, r.rpe]));
  const weeks = weeklySummaries(view, workouts, settings.sleepNeedH);
  const unestimated = workouts.filter((w) => w.day >= viewFrom && w.method === "none").length;

  const result = {
    generatedAt: new Date(opts.now ?? Date.now()).toISOString(),
    today,
    range: { from: viewFrom, to: today, days },
    settings,
    indoor,
    ftpEstimate,
    body: body ? { weightKg: body.weight_kg, heightM: body.height_m } : null,
    coach,
    earlyWarning: warning,
    hrvTrend: hrvSignal,
    returnToTraining: comeback,
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
        source: w.source,
        durationMin: Math.round((w.duration_s ?? 0) / 60),
        sourceId: w.source_id,
        rpe: rpeBy.get(`${w.source}:${w.source_id}`) ?? null,
        sessionRpe: rpeBy.has(`${w.source}:${w.source_id}`) ? sessionRpe(Math.round((w.duration_s ?? 0) / 60), rpeBy.get(`${w.source}:${w.source_id}`)!) : null,
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
    freshness: dataFreshness({ now: opts.now ?? Date.now(), sync: { whoop: whoopSync, wahoo: wahooSync }, latest: await readLatestBySource(db) }),
  };
  const journalOut = {
    today: journalToday,
    recent: journal.filter((j) => j.day >= addDays(today, -13)),
    /** Erholung am Folgetag mit/ohne Tag (Beobachtung, keine Ursache). */
    tagEffects: tagEffects(journal, series),
  };
  // Coach-Gedächtnis: Ziele, Wochenplan mit Soll/Ist, Abgleich heutige Einheit ↔ Tagesform.
  const training = await trainingOverview(db, result);
  // Schlafziel für heute Nacht (sleep-need.ts, #205) mit der Einheit von morgen aus dem Plan.
  const nights = sleepReport(sleeps, settings.timezone ?? "Europe/Berlin", addDays(today, -60), today, settings.sleepNeedH).nights;
  const tomorrowPlan = training.thisWeek.plan.days.find((x) => x.day === addDays(today, 1)) ?? null;
  // Zeit-in-Zone-Ziele (#214): Soll aus dem Wochenplan gegen die WHOOP-Pulszonen dieser Woche.
  const zoneWeek = result.hrZones.weeks.find((w) => w.week === training.thisWeek.week) ?? null;
  return { ...result, journal: journalOut, recommendationFeedback: fbAdjust, training, zoneTargets: zoneTargets(training.thisWeek.plan, zoneWeek, today), sleepTarget: sleepTarget({ today, nights, series, sleepNeedH: settings.sleepNeedH, tomorrow: tomorrowPlan }) };
}
