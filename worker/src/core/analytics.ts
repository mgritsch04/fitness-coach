// Auswertungen für die Connector-Werkzeuge get_training_load, get_fitness_profile, get_health_trends,
// get_period_summaries und get_strain_recovery. Liest einmal aus D1 und rechnet mit den reinen
// Funktionen aus analysis.ts und performance.ts. Alle Werte außer selbst gesetzten sind Schätzungen.
import { applyStrengthLoads, readStrengthSessions } from "./strength";
import {
  addDays,
  daySeries,
  effectiveSettings,
  mergeWorkouts,
  todayIn,
  trainingLoad,
  workoutLoad,
  type DailyRow,
  type SleepRow,
  type WorkoutRow,
} from "./analysis";
import {
  coefficientOfVariation,
  estimateFtp,
  healthBand,
  hrZoneReport,
  periodSummaries,
  powerCurve,
  sleepTiming,
  trainingLoadReport,
  zoneDistribution,
  zonesFor,
  type HealthKey,
  type Period,
  flattenCurves,
} from "./performance";
import { recoveryFactors, strainRecovery } from "./insights";
import { earlyWarning } from "./warnings";
import { sleepReport } from "./sleep";
import { recordsReport } from "./records";
import { lateTrainingDays, recoveryForecast, type ForecastInput } from "./forecast";
import { interferenceReport } from "./interference";
import { hrvTrend } from "./hrv-trend";
import { timingReport } from "./timing";
import { durabilityReport, readRideStreams } from "./durability";
import { aerobicReport, readHrRideStreams } from "./aerobic";
import { enduranceProfile } from "./endurance";
import { readDaily, readLatestBody, readPowerCurves, readSleeps, readWorkouts } from "./repository";
import { readSettings } from "./settings";

/** Vorlauf, damit die 42-Tage-Fitness (CTL) am Anfang der Ansicht eingeschwungen ist. */
const LOAD_WARMUP_DAYS = 120;
/** Vorlauf für den persönlichen Normalbereich (Tage −34 … −7). */
const BASELINE_DAYS = 35;
/** Zeitraum für Leistungskurve und FTP-Schätzung. */
const FTP_WINDOW_DAYS = 90;

export const ESTIMATE_NOTE = "Alle Werte außer deinen eigenen Einstellungen sind Schätzungen; Trainingsempfehlungen, keine medizinische Diagnose.";

export interface ContextOptions {
  days?: number;
  now?: number;
  maxDays?: number;
}

/** Lädt alle Daten für einen Zeitraum und rechnet Belastung, Trainingslast und Tagesreihe. */
export async function analysisContext(db: D1Database, opts: ContextOptions = {}) {
  const days = Math.min(opts.maxDays ?? 365, Math.max(7, opts.days ?? 90));
  const userSettings = await readSettings(db);
  const timezone = userSettings.timezone ?? "Europe/Berlin";
  const today = todayIn(timezone, opts.now);
  const viewFrom = addDays(today, -(days - 1));
  const statsFrom = addDays(viewFrom, -BASELINE_DAYS);
  const loadFrom = addDays(viewFrom, -LOAD_WARMUP_DAYS);
  const ftpFrom = addDays(today, -(FTP_WINDOW_DAYS - 1));
  const earliest = [loadFrom, ftpFrom].sort()[0];

  const [daily, sleeps, rawWorkouts, body, powerRows, strengthSessions] = await Promise.all([
    readDaily(db, statsFrom) as Promise<unknown> as Promise<DailyRow[]>,
    readSleeps(db, statsFrom) as Promise<unknown> as Promise<SleepRow[]>,
    readWorkouts(db, earliest) as Promise<unknown> as Promise<WorkoutRow[]>,
    readLatestBody(db) as Promise<{ max_hr: number | null; weight_kg: number | null } | null>,
    readPowerCurves(db, "0000-00-00").then(flattenCurves),
    readStrengthSessions(db, earliest),
  ]);

  const curveRecent = powerCurve(powerRows, ftpFrom);
  const ftpEstimate = estimateFtp(curveRecent, rawWorkouts, ftpFrom);
  const settings = effectiveSettings(userSettings, daily, rawWorkouts, body?.max_hr ?? null, ftpEstimate?.watts ?? null);
  // Krafteinheiten wie im Dashboard: Session-RPE statt Puls (core/strength.ts).
  const workouts = applyStrengthLoads(
    mergeWorkouts(rawWorkouts).map((w) => ({ ...w, ...workoutLoad(w, settings) })),
    strengthSessions,
  );

  const loadsByDay = new Map<string, number>();
  for (const w of workouts) if (w.load != null) loadsByDay.set(w.day, (loadsByDay.get(w.day) ?? 0) + w.load);
  const firstDay = [...loadsByDay.keys()].sort()[0] ?? statsFrom;
  const load = trainingLoad(loadsByDay, firstDay < statsFrom ? firstDay : statsFrom, today);
  const series = daySeries(daily, sleeps, workouts, load, statsFrom, today);

  return { days, today, viewFrom, statsFrom, weightKg: body?.weight_kg ?? null, settings, ftpEstimate, workouts, series, sleeps, powerRows, curveRecent };
}

export type AnalysisContext = Awaited<ReturnType<typeof analysisContext>>;

const range = (c: AnalysisContext) => ({ from: c.viewFrom, to: c.today, days: c.days });

// --- Werkzeuge ----------------------------------------------------------------------------------

export function trainingLoadView(c: AnalysisContext) {
  return {
    today: c.today,
    range: range(c),
    ...trainingLoadReport(c.series, c.workouts, c.today, c.viewFrom),
    reference: { ftpW: c.settings.ftpW, thresholdHr: c.settings.thresholdHr, origin: c.settings.origin },
    notes: [
      "Belastung im TSS-Maßstab (1 h an der Schwelle ≈ 100) aus Leistung und FTP, sonst aus dem Puls (hrTSS). Schätzung.",
      "Fitness (CTL) = 42-Tage-Mittel, Ermüdung (ATL) = 7-Tage-Mittel, Form (TSB) = Fitness − Ermüdung des Vortags.",
      ESTIMATE_NOTE,
    ],
  };
}

export function fitnessProfileView(c: AnalysisContext) {
  const inView = c.workouts.filter((w) => w.day >= c.viewFrom);
  const zones = zonesFor(c.settings);
  return {
    today: c.today,
    range: range(c),
    settings: c.settings,
    ftp: {
      watts: c.settings.ftpW,
      origin: c.settings.origin.ftpW,
      estimate: c.ftpEstimate,
      wattsPerKg: c.settings.ftpW && c.weightKg ? Number((c.settings.ftpW / c.weightKg).toFixed(2)) : null,
    },
    zones,
    zoneDistribution: {
      power: zones.power ? zoneDistribution(inView, zones.power, "power") : null,
      hr: zones.hr ? zoneDistribution(inView, zones.hr, "hr") : null,
    },
    hrZoneTime: hrZoneReport(c.workouts, c.viewFrom, c.today),
    powerCurve: {
      last30d: powerCurveFrom(c, 30),
      // last42d nutzt artifact/sections/fit.js (Fitness-Zeitraum der CTL).
      last42d: powerCurveFrom(c, 42),
      last90d: c.curveRecent,
      last365d: powerCurveFrom(c, 365),
      allTime: powerCurve(c.powerRows),
    },
    notes: [
      "Zonen: Leistung nach Coggan (Anteile der FTP), Puls nach Friel (Anteile des Schwellenpulses).",
      "Zeit je Zone ist eine Näherung: jede Einheit zählt ganz in die Zone ihrer mittleren Leistung bzw. ihres mittleren Pulses.",
      c.powerRows.length ? null : "Die Leistungskurve braucht Sekundenwerte der Leistung (FIT-Dateien von MyWhoosh oder Wahoo); bisher keine vorhanden.",
      ESTIMATE_NOTE,
    ].filter(Boolean),
  };
}

function powerCurveFrom(c: AnalysisContext, days: number) {
  return powerCurve(c.powerRows, addDays(c.today, -(days - 1)));
}

const HEALTH_KEYS: HealthKey[] = ["hrv", "rhr", "recovery", "sleepH", "respRate", "skinTemp", "spo2"];

export function healthTrendsView(c: AnalysisContext) {
  const metrics = Object.fromEntries(
    HEALTH_KEYS.map((k) => {
      const band = healthBand(c.series, k, c.viewFrom, c.today);
      const last = [...band].reverse().find((p) => p.value != null) ?? null;
      const cur = band.at(-1);
      let status: "below" | "normal" | "above" | "unknown" = "unknown";
      if (cur?.avg7 != null && cur.low != null && cur.high != null) status = cur.avg7 < cur.low ? "below" : cur.avg7 > cur.high ? "above" : "normal";
      return [k, { last: last?.value ?? null, lastDay: last?.day ?? null, avg7: cur?.avg7 ?? null, baseline: cur?.baseline ?? null, status, band }];
    }),
  );
  return {
    today: c.today,
    range: range(c),
    metrics,
    hrvStabilityCvPct: coefficientOfVariation(c.series, "hrv", c.today),
    sleep: {
      last14d: sleepTiming(c.sleeps, c.settings.timezone, addDays(c.today, -13), c.today, c.settings.sleepNeedH),
      sleepNeedH: c.settings.sleepNeedH,
    },
    notes: [
      "Normalbereich = Mittel ± 1 Standardabweichung der 28 Tage vor der letzten Woche; status vergleicht das 7-Tage-Mittel damit.",
      "Bei Ruhepuls und Atemfrequenz ist „above“ eher ungünstig, bei HRV und Erholung „below“.",
      ESTIMATE_NOTE,
    ],
  };
}

export function periodSummariesView(c: AnalysisContext, period: Period) {
  const view = c.series.filter((p) => p.day >= c.viewFrom);
  return {
    today: c.today,
    range: range(c),
    period,
    periods: periodSummaries(view, c.workouts, period, c.settings.sleepNeedH),
    notes: ["Der erste und der laufende Zeitraum können unvollständig sein (Feld days).", ESTIMATE_NOTE],
  };
}

export function strainRecoveryView(c: AnalysisContext) {
  return {
    today: c.today,
    range: range(c),
    ...strainRecovery(c.series, c.today, c.viewFrom),
    notes: [
      "Strain ist der WHOOP-Tageswert (0–21), Belastung die geschätzte Trainingslast; verglichen mit der Erholung am Folgetag.",
      "Zusammenhänge sind Beobachtungen aus deinen Daten, keine Ursache-Wirkung.",
      ESTIMATE_NOTE,
    ],
  };
}

export function recoveryFactorsView(c: AnalysisContext) {
  return {
    today: c.today,
    range: range(c),
    ...recoveryFactors(c.series, c.sleeps, c.workouts, c.settings.timezone, c.viewFrom, c.today),
    notes: [
      "Je Tag wird die Erholung bzw. HRV am Morgen mit Schlaf der Nacht davor und Training am Vortag verglichen.",
      "Stärke: Korrelation (|r| ab 0,1 schwach, 0,3 deutlich, 0,5 stark) bzw. Gruppenunterschied (Cohens d ab 0,2/0,5/0,8). Ausgewertet ab 21 Tagen.",
      "Zusammenhänge sind Beobachtungen aus deinen Daten, keine Ursache-Wirkung und keine Diagnose.",
    ],
  };
}

export function earlyWarningView(c: AnalysisContext) {
  return { today: c.today, ...earlyWarning(c.series, c.today) };
}

export function sleepReportView(c: AnalysisContext) {
  return {
    today: c.today,
    range: range(c),
    ...sleepReport(c.sleeps, c.settings.timezone, c.viewFrom, c.today, c.settings.sleepNeedH),
    notes: [
      "Nächte nach Tag des Aufwachens; Uhrzeiten in deiner Zeitzone. Schlafbedarf aus den Einstellungen (Standard 8 h).",
      "Empfohlene Schlafenszeit = übliche Aufwachzeit minus Schlafbedarf minus übliche Wachzeit im Bett (Schätzung).",
    ],
  };
}

/** Bestleistungen-Feed (#65): Rekorde über die ganze Historie, Feed über `days`, Wochenvergleich. */
export async function recordsView(db: D1Database, c: AnalysisContext, days: number) {
  const [rides, strength] = await Promise.all([
    readWorkouts(db, "0000-00-00") as Promise<unknown> as Promise<WorkoutRow[]>,
    readStrengthSessions(db, "0000-00-00"),
  ]);
  return recordsReport({ powerRows: c.powerRows, workouts: rides, strength, series: c.series }, c.today, days);
}

/** Ausdauer-Profil (#92): Critical Power/W′ aus der 90-Tage-Kurve und Effizienz-Trend lockerer Fahrten. */
export function enduranceView(c: AnalysisContext) {
  return enduranceProfile(c.curveRecent, c.workouts, c.today, c.settings.ftpW);
}

export function recoveryForecastView(c: AnalysisContext, input: ForecastInput = {}) {
  return recoveryForecast(c.series, lateTrainingDays(c.workouts, c.settings.timezone), c.today, input);
}

/** Kraft und Rad im Wechselspiel (#113): Beineinheiten gegen Erholung am Folgetag und die nächste Radeinheit. */
export async function interferenceView(db: D1Database, c: AnalysisContext, days: number) {
  const strength = await readStrengthSessions(db, addDays(c.today, -(days + 7)));
  return interferenceReport({ series: c.series, workouts: c.workouts, strength }, c.today, days);
}

/** HRV-Trend nach Plews (#125). Der Kontext braucht 67 Tage Vorlauf für Normalband und 7-Tage-Mittel. */
export function hrvTrendView(c: AnalysisContext, days: number) {
  return hrvTrend(c.series, c.today, days);
}

/** Beste Trainingszeit (#131): Tageszeit gegen Effizienz, Schlaf der Nacht danach und Erholung. */
export function trainingTimingView(c: AnalysisContext, days: number) {
  return timingReport(c.series, c.workouts, c.settings.timezone, c.today, days);
}

/** Ermüdungsresistenz (#139): beste 5/20 min frisch und nach 500/1000/1500 kJ, aus FIT-Sekundenwerten. */
export async function durabilityView(db: D1Database, days: number, now?: number) {
  const settings = await readSettings(db);
  const today = todayIn(settings.timezone ?? "Europe/Berlin", now);
  return durabilityReport(await readRideStreams(db, addDays(today, -(days - 1))), today, days);
}

/** Aerobe Basis (#145): Pa:HR-Entkopplung gleichmäßiger Fahrten im Verlauf, aus FIT-Sekundenwerten. */
export async function aerobicView(db: D1Database, days: number, now?: number) {
  const settings = await readSettings(db);
  const today = todayIn(settings.timezone ?? "Europe/Berlin", now);
  return aerobicReport(await readHrRideStreams(db, addDays(today, -(days - 1))), today, days);
}
