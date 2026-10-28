// Leistungsprofil und Langzeitauswertungen auf dem gemeinsamen Datenmodell, aufbauend auf analysis.ts:
// Leistungskurve (beste Durchschnittsleistung je Dauer), FTP-Schätzung, Leistungs- und Pulszonen,
// Zonenverteilung, Form-Bereiche, Wochen-/Monats-/Jahreszusammenfassungen,
// Gesundheitstrends mit persönlichem Normalbereich und Schlafrhythmus.
// Reine Funktionen ohne D1. Alles außer selbst gesetzten Werten ist eine Schätzung.
import { addDays, weekStart, type DayPoint, type EffectiveSettings, type MergedWorkout, type SleepRow, type WorkoutLoad, type WorkoutRow } from "./analysis";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));

type LoadedWorkout = MergedWorkout & WorkoutLoad;

// --- Leistungskurve -----------------------------------------------------------------------------

/** Werte darüber gelten als Messfehler des Leistungsmessers. */
const MAX_PLAUSIBLE_W = 2500;

/** Ein Bestwert einer Fahrt (aus workout_streams.power_curve, berechnet von power.ts beim FIT-Import). */
export interface PowerBestRow {
  source: string;
  source_id: string;
  day: string;
  duration_s: number;
  watts: number;
}

/** Kurven je Workout (readPowerCurves) in einzelne Bestwerte zerlegen. */
export function flattenCurves(rows: readonly { day: string; source: string; source_id: string; power_curve: Record<string, number> }[]): PowerBestRow[] {
  return rows.flatMap((r) =>
    Object.entries(r.power_curve).map(([d, w]) => ({ source: r.source, source_id: r.source_id, day: r.day, duration_s: Number(d), watts: w })),
  );
}

export interface CurvePoint {
  durationS: number;
  watts: number;
  /** Tag und Quelle der Fahrt, aus der der Bestwert stammt. */
  day: string;
  source: string;
}

/** Bestwert je Dauer über alle Fahrten ab `fromDay` (inklusive). */
export function powerCurve(rows: readonly PowerBestRow[], fromDay = "0000-00-00"): CurvePoint[] {
  const best = new Map<number, CurvePoint>();
  for (const r of rows) {
    if (r.day < fromDay || !(r.watts > 0)) continue;
    const cur = best.get(r.duration_s);
    if (!cur || r.watts > cur.watts) best.set(r.duration_s, { durationS: r.duration_s, watts: r.watts, day: r.day, source: r.source });
  }
  return [...best.values()].sort((a, b) => a.durationS - b.durationS);
}

// --- FTP-Schätzung ------------------------------------------------------------------------------

export interface FtpEstimate {
  watts: number;
  method: "curve_20min" | "curve_60min" | "workouts_np";
  /** medium: aus einer Bestleistung über 20/60 min; low: Untergrenze aus normalen Fahrten. */
  confidence: "medium" | "low";
  basedOn: { day: string; durationS: number; watts: number };
  note: string;
}

/** Erwartete Intensität einer maximalen Dauerleistung relativ zur FTP (Faustregel, ≥ 60 min = 1). */
function ftpFactor(durationS: number): number {
  if (durationS >= 3600) return 1;
  if (durationS <= 1200) return 0.95;
  return 0.95 + 0.05 * (Math.log(durationS / 1200) / Math.log(3)); // 20 → 60 min, logarithmisch
}

/**
 * Schätzt die FTP. Mit Leistungskurve: max(95 % der besten 20 min, beste 60 min).
 * Sonst aus normalisierter (bzw. mittlerer) Leistung von Fahrten ab 20 Minuten – das ist eine
 * Untergrenze, weil normale Fahrten selten maximal sind.
 */
export function estimateFtp(curve: readonly CurvePoint[], workouts: readonly WorkoutRow[], fromDay: string): FtpEstimate | null {
  const c20 = curve.find((p) => p.durationS === 1200);
  const c60 = curve.find((p) => p.durationS === 3600);
  const fromCurve = [
    c20 && { watts: c20.watts * 0.95, method: "curve_20min" as const, p: c20 },
    c60 && { watts: c60.watts, method: "curve_60min" as const, p: c60 },
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (fromCurve.length) {
    const best = fromCurve.reduce((a, b) => (b.watts > a.watts ? b : a));
    return {
      watts: Math.round(best.watts),
      method: best.method,
      confidence: "medium",
      basedOn: { day: best.p.day, durationS: best.p.durationS, watts: best.p.watts },
      note:
        best.method === "curve_20min"
          ? "Schätzung: 95 % deiner besten 20-Minuten-Leistung."
          : "Schätzung: deine beste 60-Minuten-Leistung.",
    };
  }
  let best: { watts: number; w: WorkoutRow; p: number } | null = null;
  for (const w of workouts) {
    const p = w.normalized_power_w ?? w.avg_power_w;
    const d = w.duration_s ?? 0;
    if (w.day < fromDay || p == null || !(p > 0) || p > MAX_PLAUSIBLE_W || d < 1200) continue;
    const est = p * ftpFactor(d);
    if (!best || est > best.watts) best = { watts: est, w, p };
  }
  if (!best) return null;
  return {
    watts: Math.round(best.watts),
    method: "workouts_np",
    confidence: "low",
    basedOn: { day: best.w.day, durationS: best.w.duration_s ?? 0, watts: Math.round(best.p) },
    note: "Grobe Schätzung (eher Untergrenze) aus der Leistung normaler Fahrten. Ein FTP-Test oder ein hartes 20-Minuten-Intervall macht sie genauer.",
  };
}

// --- Zonen ----------------------------------------------------------------------------------------

export interface Zone {
  zone: number;
  name: string;
  /** Untergrenze (W bzw. Schläge/min), inklusive. */
  min: number;
  /** Obergrenze, inklusive; null = offen. */
  max: number | null;
}

function buildZones(reference: number, bounds: readonly number[], names: readonly string[]): Zone[] {
  return names.map((name, i) => ({
    zone: i + 1,
    name,
    min: i === 0 ? 0 : Math.round(bounds[i - 1] * reference) + 1,
    max: i < bounds.length ? Math.round(bounds[i] * reference) : null,
  }));
}

/** Leistungszonen nach Coggan (7 Zonen, Anteile der FTP). */
export function powerZones(ftpW: number): Zone[] {
  return buildZones(ftpW, [0.55, 0.75, 0.9, 1.05, 1.2, 1.5], [
    "Aktive Erholung",
    "Grundlage",
    "Tempo",
    "Schwelle",
    "VO2max",
    "Anaerob",
    "Neuromuskulär",
  ]);
}

/** Pulszonen nach Friel (5 Zonen, Anteile des Schwellenpulses). */
export function hrZones(thresholdHr: number): Zone[] {
  return buildZones(thresholdHr, [0.81, 0.89, 0.93, 0.99], ["Erholung", "Grundlage", "Tempo", "Schwelle", "Über der Schwelle"]);
}

export function zoneOf(value: number, zones: readonly Zone[]): number {
  for (const z of zones) if (z.max == null || value <= z.max) return z.zone;
  return zones.at(-1)?.zone ?? 0;
}

export interface ZoneDistribution {
  basis: "power" | "hr";
  zones: (Zone & { minutes: number; sharePct: number; workouts: number })[];
  totalMinutes: number;
  /** Verteilung grob in locker (Zone 1–2), mittel (3) und hart (4+), in Prozent der Zeit. */
  intensity: { easyPct: number; moderatePct: number; hardPct: number };
}

/**
 * Zeit je Zone. Ohne Sekundenwerte wird jede Einheit ohne Sekundenwerte vollständig der Zone ihrer mittleren
 * (normalisierten) Leistung bzw. ihres mittleren Pulses zugeordnet – eine Näherung.
 */
export function zoneDistribution(
  workouts: readonly WorkoutRow[],
  zones: readonly Zone[],
  basis: "power" | "hr",
  /** Messwerte je Sekunde (Leistung bzw. Puls) nach "quelle:id"; damit zählt die Zeit je Zone statt des Mittelwerts. */
  streams?: ReadonlyMap<string, readonly (number | null)[]>,
): ZoneDistribution {
  const acc = zones.map((z) => ({ ...z, minutes: 0, sharePct: 0, workouts: 0 }));
  for (const w of workouts) {
    const stream = streams?.get(`${w.source}:${w.source_id}`);
    // Leistung 0 W (Rollen) zählt in Zone 1; Puls 0 ist kein Messwert.
    const min = basis === "power" ? 0 : 1;
    if (stream?.some((p) => p != null && p >= min)) {
      const secs = zones.map(() => 0);
      for (const p of stream) if (p != null && p >= min) secs[zoneOf(p, zones) - 1]++;
      secs.forEach((s, i) => { if (s) acc[i].minutes += s / 60; });
      for (const [i, s] of secs.entries()) if (s) acc[i].workouts++;
      continue;
    }
    const v = basis === "power" ? (w.normalized_power_w ?? w.avg_power_w) : w.avg_hr;
    const minutes = (w.duration_s ?? 0) / 60;
    if (v == null || !(v > 0) || !(minutes > 0)) continue;
    const z = acc[zoneOf(v, zones) - 1];
    z.minutes += minutes;
    z.workouts++;
  }
  const total = acc.reduce((a, z) => a + z.minutes, 0);
  for (const z of acc) {
    z.sharePct = total ? round((z.minutes / total) * 100)! : 0;
    z.minutes = Math.round(z.minutes);
  }
  const share = (pred: (zone: number) => boolean) =>
    total ? round((acc.filter((z) => pred(z.zone)).reduce((a, z) => a + z.minutes, 0) / Math.round(total)) * 100)! : 0;
  return {
    basis,
    zones: acc,
    totalMinutes: Math.round(total),
    intensity: { easyPct: share((z) => z <= 2), moderatePct: share((z) => z === 3), hardPct: share((z) => z >= 4) },
  };
}

// --- Form und Trainingslast ----------------------------------------------------------------------

export type FormZone = "overreaching" | "productive" | "maintaining" | "fresh" | "detraining";

export const FORM_LABEL: Record<FormZone, string> = {
  overreaching: "Sehr hohe Ermüdung",
  productive: "Produktives Training",
  maintaining: "Erhaltung",
  fresh: "Frisch",
  detraining: "Formverlust durch wenig Training",
};

/** Bereiche der Form (TSB) nach gängiger TrainingPeaks-Faustregel. */
export function formZone(tsb: number): FormZone {
  if (tsb < -30) return "overreaching";
  if (tsb < -10) return "productive";
  if (tsb <= 5) return "maintaining";
  if (tsb <= 25) return "fresh";
  return "detraining";
}

export interface TrainingLoadReport {
  current: {
    day: string;
    ctl: number;
    atl: number;
    tsb: number;
    formZone: FormZone;
    formLabel: string;
    /** Veränderung der Fitness (CTL) in den letzten 7 Tagen. */
    rampRate7d: number | null;
    /** Ermüdung / Fitness (ATL/CTL); grob 0,8–1,3 gilt als ausgewogen. Null bei sehr wenig Training. */
    acwr: number | null;
    /** Summe der Belastung der letzten 7 und 28 Tage. */
    load7d: number;
    load28d: number;
  } | null;
  days: { day: string; load: number; ctl: number; atl: number; tsb: number; formZone: FormZone }[];
  /** Belastungsmonotonie (Foster) der letzten 7 Tage: Mittel / Streuung der Tagesbelastung; > 2 gilt als eintönig. */
  monotony7d: number | null;
  methods: { power: number; hr: number; none: number };
  topWorkouts: { day: string; sport: string | null; durationMin: number; load: number; method: string; intensity: number | null; sources: string[] }[];
}

export function trainingLoadReport(series: readonly DayPoint[], workouts: readonly LoadedWorkout[], today: string, viewFrom: string): TrainingLoadReport {
  const view = series.filter((p) => p.day >= viewFrom && p.day <= today);
  const byDay = new Map(series.map((p) => [p.day, p]));
  const t = byDay.get(today) ?? view.at(-1);
  const weekAgo = t ? byDay.get(addDays(t.day, -7)) : undefined;
  const sumLoad = (fromOff: number) => (t ? series.filter((p) => p.day > addDays(t.day, fromOff) && p.day <= t.day).reduce((a, p) => a + p.load, 0) : 0);
  const last7 = t ? series.filter((p) => p.day > addDays(t.day, -7) && p.day <= t.day).map((p) => p.load) : [];
  const m7 = mean(last7), s7 = sd(last7);
  const inView = workouts.filter((w) => w.day >= viewFrom && w.day <= today);
  return {
    current: t
      ? {
          day: t.day,
          ctl: t.ctl,
          atl: t.atl,
          tsb: t.tsb,
          formZone: formZone(t.tsb),
          formLabel: FORM_LABEL[formZone(t.tsb)],
          rampRate7d: weekAgo ? round(t.ctl - weekAgo.ctl) : null,
          acwr: t.ctl >= 5 ? round(t.atl / t.ctl, 2) : null,
          load7d: round(sumLoad(-7))!,
          load28d: round(sumLoad(-28))!,
        }
      : null,
    days: view.map((p) => ({ day: p.day, load: p.load, ctl: p.ctl, atl: p.atl, tsb: p.tsb, formZone: formZone(p.tsb) })),
    monotony7d: m7 != null && m7 > 0 && s7 ? round(m7 / s7, 2) : null,
    methods: {
      power: inView.filter((w) => w.method === "power").length,
      hr: inView.filter((w) => w.method === "hr").length,
      none: inView.filter((w) => w.method === "none").length,
    },
    topWorkouts: inView
      .filter((w) => w.load != null)
      .sort((a, b) => (b.load ?? 0) - (a.load ?? 0))
      .slice(0, 10)
      .map((w) => ({
        day: w.day,
        sport: w.sport,
        durationMin: Math.round((w.duration_s ?? 0) / 60),
        load: w.load!,
        method: w.method,
        intensity: w.intensity,
        sources: w.sources,
      })),
  };
}

// --- Zeiträume ----------------------------------------------------------------------------------

export type Period = "week" | "month" | "year";

/** Schlüssel des Zeitraums: Montag der Woche, YYYY-MM oder YYYY. */
export function periodKey(day: string, period: Period): string {
  if (period === "week") return weekStart(day);
  return period === "month" ? day.slice(0, 7) : day.slice(0, 4);
}

export interface PeriodSummary {
  period: string;
  from: string;
  to: string;
  /** Tage des Zeitraums, die in der Auswertung liegen (laufender Zeitraum ist kürzer). */
  days: number;
  workouts: number;
  trainingDays: number;
  trainingH: number;
  load: number;
  avgDailyLoad: number;
  distanceKm: number;
  energyKj: number;
  bySport: Record<string, { count: number; minutes: number; distanceKm: number }>;
  avgRecovery: number | null;
  /** Tage nach WHOOP-Farben: grün ≥ 67 %, gelb 34–66 %, rot < 34 %. */
  recoveryDays: { green: number; yellow: number; red: number };
  avgHrv: number | null;
  avgRhr: number | null;
  avgSleepH: number | null;
  sleepDebtH: number | null;
  avgStrain: number | null;
  ctlStart: number;
  ctlEnd: number;
  ctlChange: number;
  /** Veränderung der Belastung gegenüber dem vorigen Zeitraum in Prozent (je Tag gerechnet). */
  loadChangePct: number | null;
}

export function periodSummaries(series: readonly DayPoint[], workouts: readonly LoadedWorkout[], period: Period, sleepNeedH: number): PeriodSummary[] {
  const groups = new Map<string, DayPoint[]>();
  for (const p of series) {
    const k = periodKey(p.day, period);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  const out: PeriodSummary[] = [];
  let prev: PeriodSummary | null = null;
  let prevCtl: number | null = null;
  for (const [key, days] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const from = days[0].day, to = days.at(-1)!.day;
    const ws = workouts.filter((w) => w.day >= from && w.day <= to);
    const bySport: PeriodSummary["bySport"] = {};
    for (const w of ws) {
      const s = (bySport[w.sport ?? "andere"] ??= { count: 0, minutes: 0, distanceKm: 0 });
      s.count++;
      s.minutes += Math.round((w.duration_s ?? 0) / 60);
      s.distanceKm = round(s.distanceKm + (w.distance_m ?? 0) / 1000)!;
    }
    const rec = nums(days.map((d) => d.recovery));
    const sleepH = nums(days.map((d) => d.sleepH));
    const load = days.reduce((a, d) => a + d.load, 0);
    const avgDailyLoad = load / days.length;
    const ctlEnd = days.at(-1)!.ctl;
    const ctlStart = prevCtl ?? days[0].ctl;
    const summary: PeriodSummary = {
      period: key,
      from,
      to,
      days: days.length,
      workouts: ws.length,
      trainingDays: new Set(ws.map((w) => w.day)).size,
      trainingH: round(ws.reduce((a, w) => a + (w.duration_s ?? 0), 0) / 3600, 2)!,
      load: round(load)!,
      avgDailyLoad: round(avgDailyLoad)!,
      distanceKm: round(ws.reduce((a, w) => a + (w.distance_m ?? 0), 0) / 1000)!,
      energyKj: Math.round(ws.reduce((a, w) => a + (w.energy_kj ?? 0), 0)),
      bySport,
      avgRecovery: round(mean(rec), 0),
      recoveryDays: { green: rec.filter((r) => r >= 67).length, yellow: rec.filter((r) => r >= 34 && r < 67).length, red: rec.filter((r) => r < 34).length },
      avgHrv: round(mean(nums(days.map((d) => d.hrv)))),
      avgRhr: round(mean(nums(days.map((d) => d.rhr)))),
      avgSleepH: round(mean(sleepH), 2),
      sleepDebtH: sleepH.length ? round(sleepH.reduce((a, h) => a + (sleepNeedH - h), 0)) : null,
      avgStrain: round(mean(nums(days.map((d) => d.strain)))),
      ctlStart,
      ctlEnd,
      ctlChange: round(ctlEnd - ctlStart)!,
      loadChangePct: prev && prev.avgDailyLoad > 0 ? round(((avgDailyLoad - prev.avgDailyLoad) / prev.avgDailyLoad) * 100) : null,
    };
    out.push(summary);
    prev = summary;
    prevCtl = ctlEnd;
  }
  return out;
}

// --- Gesundheitstrends mit Normalbereich --------------------------------------------------------

export type HealthKey = "hrv" | "rhr" | "recovery" | "sleepH" | "respRate" | "skinTemp" | "spo2";

export interface BandPoint {
  day: string;
  value: number | null;
  /** Gleitendes 7-Tage-Mittel. */
  avg7: number | null;
  /** Persönlicher Normalbereich aus den 28 Tagen davor (Tage −34 … −7): Mittel ± 1 Standardabweichung. */
  baseline: number | null;
  low: number | null;
  high: number | null;
}

export function healthBand(series: readonly DayPoint[], key: HealthKey, fromDay: string, toDay: string): BandPoint[] {
  const val = new Map(series.map((p) => [p.day, p[key] as number | null]));
  const window = (day: string, fromOff: number, toOff: number) => {
    const xs: number[] = [];
    for (let d = addDays(day, fromOff); d <= addDays(day, toOff); d = addDays(d, 1)) {
      const v = val.get(d);
      if (v != null) xs.push(v);
    }
    return xs;
  };
  const out: BandPoint[] = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const base = window(day, -34, -7);
    const b = base.length >= 7 ? mean(base) : null, s = base.length >= 7 ? sd(base) : null;
    out.push({
      day,
      value: val.get(day) ?? null,
      avg7: round(mean(window(day, -6, 0)), 2),
      baseline: round(b, 2),
      low: b != null && s != null ? round(b - s, 2) : null,
      high: b != null && s != null ? round(b + s, 2) : null,
    });
  }
  return out;
}

/** Variationskoeffizient der letzten 7 Werte in Prozent (Stabilität, z. B. der HRV). */
export function coefficientOfVariation(series: readonly DayPoint[], key: HealthKey, today: string): number | null {
  const xs = nums(series.filter((p) => p.day > addDays(today, -7) && p.day <= today).map((p) => p[key] as number | null));
  const m = mean(xs), s = sd(xs);
  return xs.length >= 4 && m && s != null ? round((s / m) * 100) : null;
}

// --- Schlafrhythmus -----------------------------------------------------------------------------

export function localMinutes(iso: string, timeZone: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
    const h = Number(parts.find((p) => p.type === "hour")?.value), m = Number(parts.find((p) => p.type === "minute")?.value);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  } catch {
    return null;
  }
}

export const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export interface SleepTiming {
  nights: number;
  /** Mittlere Einschlaf- und Aufwachzeit (lokal, HH:MM). */
  avgBedtime: string | null;
  avgWake: string | null;
  /** Streuung in Minuten – je kleiner, desto regelmäßiger. */
  bedtimeSdMin: number | null;
  wakeSdMin: number | null;
  /** Schlafschuld der letzten 7 Nächte in Stunden gegenüber dem Schlafbedarf (negativ = Überschuss). */
  debt7dH: number | null;
}

/** Schlafrhythmus der Hauptschlafphasen ab `fromDay`. */
export function sleepTiming(sleeps: readonly SleepRow[], timeZone: string, fromDay: string, today: string, sleepNeedH: number): SleepTiming {
  const main = new Map<string, SleepRow>();
  for (const s of sleeps) {
    if (s.is_nap || s.day < fromDay || s.day > today) continue;
    const cur = main.get(s.day);
    if (!cur || (s.asleep_s ?? 0) > (cur.asleep_s ?? 0)) main.set(s.day, s);
  }
  const nights = [...main.values()];
  // Einschlafzeiten um Mitternacht herum: ab 12:00 gezählt, damit 23:30 und 00:30 nah beieinander liegen.
  const bed = nums(nights.map((s) => localMinutes(s.start_time, timeZone))).map((m) => (m + 720) % 1440);
  const wake = nums(nights.map((s) => localMinutes(s.end_time, timeZone)));
  const last7 = nums([...main.entries()].filter(([d]) => d > addDays(today, -7)).map(([, s]) => (s.asleep_s != null ? s.asleep_s / 3600 : null)));
  const mb = mean(bed), mw = mean(wake);
  return {
    nights: nights.length,
    avgBedtime: mb != null ? hhmm(mb - 720) : null,
    avgWake: mw != null ? hhmm(mw) : null,
    bedtimeSdMin: round(sd(bed), 0),
    wakeSdMin: round(sd(wake), 0),
    debt7dH: last7.length ? round(last7.reduce((a, h) => a + (sleepNeedH - h), 0)) : null,
  };
}

/** Effektive Einstellungen mit Zonen für die Oberfläche. */
export function zonesFor(s: Pick<EffectiveSettings, "ftpW" | "thresholdHr">) {
  return { power: s.ftpW ? powerZones(s.ftpW) : null, hr: s.thresholdHr ? hrZones(s.thresholdHr) : null };
}

// --- Zeit in Pulszonen (#19) --------------------------------------------------------------------

/** Pulszonen 0–5 nach WHOOP-Schema (Anteile der maximalen Herzfrequenz). */
export const HR_ZONE_SCHEME = [
  { zone: 0, name: "unter 50 % HFmax" },
  { zone: 1, name: "50–60 % (sehr leicht)" },
  { zone: 2, name: "60–70 % (leicht)" },
  { zone: 3, name: "70–80 % (moderat)" },
  { zone: 4, name: "80–90 % (hart)" },
  { zone: 5, name: "90–100 % (maximal)" },
] as const;

/**
 * Zone 1–3 zählt als locker, 4 als mittel, 5 als hart (grobe Übertragung des 3-Zonen-Modells nach Seiler
 * auf % HFmax). Zone 0 (unter 50 %, z. B. Pausen im Krafttraining) zählt nicht zur Trainingsintensität.
 */
const intensityOf = (zone: number) => (zone === 0 ? "none" : zone <= 3 ? "easy" : zone === 4 ? "moderate" : "hard");

export function parseZones(json: string | null | undefined): number[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) && v.length === 6 && v.every((x) => typeof x === "number" && x >= 0) ? v : null;
  } catch {
    return null;
  }
}

export interface HrZoneTime {
  /** Minuten je Zone 0–5. */
  minutes: number[];
  /** Anteile locker (Zone 1–3), mittel (4), hart (5) an der Zeit ab Zone 1. */
  totalMin: number;
  workouts: number;
  easyPct: number;
  moderatePct: number;
  hardPct: number;
}

function zoneTime(rows: readonly WorkoutRow[]): HrZoneTime {
  const sec = [0, 0, 0, 0, 0, 0];
  let workouts = 0;
  for (const w of rows) {
    const z = parseZones(w.hr_zone_s);
    if (!z) continue;
    workouts++;
    z.forEach((s, i) => (sec[i] += s));
  }
  const total = sec.reduce((a, b) => a + b, 0);
  const active = total - sec[0];
  const pct = (k: string) => (active ? round((sec.reduce((a, s, i) => a + (intensityOf(i) === k ? s : 0), 0) / active) * 100)! : 0);
  return {
    minutes: sec.map((s) => Math.round(s / 60)),
    totalMin: Math.round(total / 60),
    workouts,
    easyPct: pct("easy"),
    moderatePct: pct("moderate"),
    hardPct: pct("hard"),
  };
}

export interface HrZoneReport {
  scheme: typeof HR_ZONE_SCHEME;
  total: HrZoneTime;
  weeks: (HrZoneTime & { week: string })[];
  /** Hinweis zur Verteilung (Ziel grob 80 % locker), null bei zu wenig Daten. */
  verdict: string | null;
}

/** Zeit je Pulszone für Workouts ab `fromDay`, gesamt und je Woche (Montag). */
export function hrZoneReport(workouts: readonly WorkoutRow[], fromDay: string, toDay: string): HrZoneReport {
  const inRange = workouts.filter((w) => w.day >= fromDay && w.day <= toDay);
  const weeks = new Map<string, WorkoutRow[]>();
  for (let d = weekStart(fromDay); d <= toDay; d = addDays(d, 7)) weeks.set(d, []);
  for (const w of inRange) weeks.get(weekStart(w.day))?.push(w);
  const total = zoneTime(inRange);
  let verdict: string | null = null;
  if (total.totalMin - total.minutes[0] >= 180) {
    if (total.easyPct >= 75) verdict = `${total.easyPct} % deiner Trainingszeit war locker – passt zum 80/20-Prinzip.`;
    else if (total.moderatePct > total.hardPct && total.moderatePct >= 20)
      verdict = `Viel Zeit im mittleren Bereich (${total.moderatePct} %). Für mehr Fortschritt locker lockerer und hart härter trainieren (Ziel etwa 80 % locker).`;
    else verdict = `Nur ${total.easyPct} % locker. Mehr ruhige Grundlage (Ziel etwa 80 %) hilft bei Erholung und Ausdauer.`;
  }
  return {
    scheme: HR_ZONE_SCHEME,
    total,
    weeks: [...weeks.entries()].map(([week, ws]) => ({ week, ...zoneTime(ws) })),
    verdict,
  };
}
