// Auswertung auf dem gemeinsamen Datenmodell: Duplikat-Abgleich, Belastung je Workout,
// Trainingslast (CTL/ATL/TSB), Trends, Wochenübersicht. Reine Funktionen ohne D1, damit sie
// mit synthetischen Daten testbar sind. Alle Belastungswerte sind Schätzungen (siehe `method`).

export interface DailyRow {
  day: string;
  source: string;
  strain: number | null;
  energy_kj: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  recovery_score: number | null;
  resting_hr: number | null;
  hrv_ms: number | null;
  spo2_pct: number | null;
  skin_temp_c: number | null;
}

export interface SleepRow {
  day: string;
  source: string;
  start_time: string;
  end_time: string;
  is_nap: number | boolean;
  in_bed_s: number | null;
  asleep_s: number | null;
  awake_s: number | null;
  light_s: number | null;
  deep_s: number | null;
  rem_s: number | null;
  performance_pct: number | null;
  efficiency_pct: number | null;
  consistency_pct: number | null;
  respiratory_rate: number | null;
}

export interface WorkoutRow {
  day: string;
  source: string;
  source_id: string;
  start_time: string;
  end_time: string;
  sport: string | null;
  duration_s: number | null;
  distance_m: number | null;
  energy_kj: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power_w: number | null;
  normalized_power_w: number | null;
  strain: number | null;
}

/** Vom Nutzer gesetzte Werte; fehlende werden aus den Daten geschätzt. */
export interface UserSettings {
  ftpW?: number | null;
  maxHr?: number | null;
  restingHr?: number | null;
  thresholdHr?: number | null;
  sleepNeedH?: number | null;
  timezone?: string | null;
}

export interface EffectiveSettings {
  ftpW: number | null;
  maxHr: number | null;
  restingHr: number | null;
  thresholdHr: number | null;
  sleepNeedH: number;
  timezone: string;
  /** Woher jeder Wert stammt: gesetzt (user), gemessen (data) oder Standard (default). */
  origin: Record<"ftpW" | "maxHr" | "restingHr" | "thresholdHr" | "sleepNeedH" | "timezone", "user" | "data" | "default" | "none">;
}

export const DEFAULT_TIMEZONE = "Europe/Berlin";
export const DEFAULT_SLEEP_NEED_H = 8;
const DAY_MS = 86_400_000;

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY_MS);
}

/** Heutiges Datum in der Zeitzone des Nutzers. */
export function todayIn(timeZone: string, now = Date.now()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
}

/** Montag der ISO-Woche. */
export function weekStart(day: string): string {
  const dow = (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}

// --- Einstellungen ---------------------------------------------------------------------------

/** `ftpEstimateW`: FTP-Schätzung aus den Leistungsdaten (performance.ts), gilt nur ohne eigene FTP. */
export function effectiveSettings(
  user: UserSettings,
  daily: DailyRow[],
  workouts: WorkoutRow[],
  bodyMaxHr: number | null,
  ftpEstimateW: number | null = null,
): EffectiveSettings {
  const origin: EffectiveSettings["origin"] = { ftpW: "none", maxHr: "none", restingHr: "none", thresholdHr: "none", sleepNeedH: "default", timezone: "default" };

  let maxHr: number | null = null;
  if (user.maxHr) [maxHr, origin.maxHr] = [user.maxHr, "user"];
  else {
    const observed = Math.max(0, ...nums(workouts.map((w) => w.max_hr)), ...nums(daily.map((d) => d.max_hr)));
    const best = Math.max(bodyMaxHr ?? 0, observed);
    if (best > 0) [maxHr, origin.maxHr] = [best, "data"];
  }

  let restingHr: number | null = null;
  if (user.restingHr) [restingHr, origin.restingHr] = [user.restingHr, "user"];
  else {
    const recent = [...daily].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 30);
    const med = median(nums(recent.map((d) => d.resting_hr)));
    if (med != null) [restingHr, origin.restingHr] = [Math.round(med), "data"];
  }

  let thresholdHr: number | null = null;
  if (user.thresholdHr) [thresholdHr, origin.thresholdHr] = [user.thresholdHr, "user"];
  else if (maxHr && restingHr) {
    // Schätzung: Schwelle bei etwa 85 % der Herzfrequenzreserve.
    [thresholdHr, origin.thresholdHr] = [Math.round(restingHr + 0.85 * (maxHr - restingHr)), "default"];
  }

  let ftpW: number | null = null;
  if (user.ftpW) [ftpW, origin.ftpW] = [user.ftpW, "user"];
  else if (ftpEstimateW) [ftpW, origin.ftpW] = [ftpEstimateW, "data"];
  const sleepNeedH = user.sleepNeedH ?? DEFAULT_SLEEP_NEED_H;
  if (user.sleepNeedH) origin.sleepNeedH = "user";
  const timezone = user.timezone ?? DEFAULT_TIMEZONE;
  if (user.timezone) origin.timezone = "user";

  return { ftpW, maxHr, restingHr, thresholdHr, sleepNeedH, timezone, origin };
}

// --- Duplikate ----------------------------------------------------------------------------------

export interface MergedWorkout extends WorkoutRow {
  /** Alle Quellen, aus denen diese Einheit stammt (erste = Hauptquelle). */
  sources: string[];
}

/** Rangfolge der Hauptquelle: Leistungsdaten (Radcomputer/Trainer) vor Pulsband. */
const SOURCE_RANK: Record<string, number> = { wahoo: 0, mywhoosh: 1, whoop: 2 };
const rank = (w: WorkoutRow) => (w.avg_power_w != null || w.normalized_power_w != null ? 0 : 10) + (SOURCE_RANK[w.source] ?? 5);

/** Toleranz für „dieselbe Einheit“: Startzeit höchstens 10 Minuten auseinander oder 70 % Überlappung. */
export function isSameSession(a: WorkoutRow, b: WorkoutRow): boolean {
  if (a.source === b.source) return false;
  const as = Date.parse(a.start_time), ae = Date.parse(a.end_time);
  const bs = Date.parse(b.start_time), be = Date.parse(b.end_time);
  if (Math.abs(as - bs) <= 10 * 60_000) return true;
  const overlap = Math.min(ae, be) - Math.max(as, bs);
  const shorter = Math.min(ae - as, be - bs);
  return shorter > 0 && overlap / shorter >= 0.7;
}

/**
 * Führt dieselbe Einheit aus mehreren Quellen zusammen. Hauptquelle ist die mit Leistungsdaten;
 * fehlende Felder (z. B. Puls oder Strain von WHOOP) werden aus den anderen ergänzt.
 */
export function mergeWorkouts(rows: WorkoutRow[]): MergedWorkout[] {
  const sorted = [...rows].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const groups: WorkoutRow[][] = [];
  for (const w of sorted) {
    const g = groups.find((grp) => grp.every((x) => x.source !== w.source) && grp.some((x) => isSameSession(x, w)));
    if (g) g.push(w);
    else groups.push([w]);
  }
  return groups
    .map((g) => {
      const [main, ...rest] = [...g].sort((a, b) => rank(a) - rank(b));
      const merged: MergedWorkout = { ...main, sources: [main.source, ...rest.map((r) => r.source)] };
      for (const r of rest) {
        for (const k of Object.keys(r) as (keyof WorkoutRow)[]) {
          if (merged[k] == null && r[k] != null) (merged as unknown as Record<string, unknown>)[k] = r[k];
        }
        if (r.max_hr != null && (merged.max_hr == null || r.max_hr > merged.max_hr)) merged.max_hr = r.max_hr;
      }
      return merged;
    })
    .sort((a, b) => b.start_time.localeCompare(a.start_time));
}

// --- Belastung je Workout -----------------------------------------------------------------------

export type LoadMethod = "power" | "hr" | "none";

export interface WorkoutLoad {
  load: number | null;
  method: LoadMethod;
  intensity: number | null;
}

/**
 * Belastungspunkte im TSS-Maßstab (1 h an der Schwelle ≈ 100).
 * Mit Leistung und FTP: TSS = h · IF² · 100. Sonst aus dem Puls (TRIMP nach Banister, auf die
 * Schwelle normiert, „hrTSS“). Ohne beides: keine Schätzung.
 */
export function workoutLoad(w: WorkoutRow, s: Pick<EffectiveSettings, "ftpW" | "maxHr" | "restingHr" | "thresholdHr">): WorkoutLoad {
  const hours = (w.duration_s ?? 0) / 3600;
  if (hours <= 0) return { load: null, method: "none", intensity: null };
  const np = w.normalized_power_w ?? w.avg_power_w;
  if (np != null && np > 0 && s.ftpW) {
    const ifactor = np / s.ftpW;
    return { load: round(hours * ifactor * ifactor * 100), method: "power", intensity: round(ifactor, 2) };
  }
  if (w.avg_hr != null && s.maxHr && s.restingHr && s.maxHr > s.restingHr) {
    const reserve = s.maxHr - s.restingHr;
    const hrr = Math.min(1, Math.max(0, (w.avg_hr - s.restingHr) / reserve));
    const thr = s.thresholdHr ? Math.min(1, Math.max(0.5, (s.thresholdHr - s.restingHr) / reserve)) : 0.85;
    const trimp = (x: number, minutes: number) => minutes * x * 0.64 * Math.exp(1.92 * x);
    return { load: round((trimp(hrr, hours * 60) / trimp(thr, 60)) * 100), method: "hr", intensity: round(hrr / thr, 2) };
  }
  return { load: null, method: "none", intensity: null };
}

// --- Trainingslast ------------------------------------------------------------------------------

export interface LoadPoint {
  day: string;
  load: number;
  /** Fitness: 42-Tage-Mittel der Belastung. */
  ctl: number;
  /** Ermüdung: 7-Tage-Mittel. */
  atl: number;
  /** Form: CTL − ATL des Vortags (positiv = ausgeruht). */
  tsb: number;
}

/** Exponentiell gewichtete Mittel (TrainingPeaks-Schema) über jeden Tag von `from` bis `to`. */
export function trainingLoad(loadsByDay: Map<string, number>, from: string, to: string): LoadPoint[] {
  const out: LoadPoint[] = [];
  let ctl = 0, atl = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const load = loadsByDay.get(day) ?? 0;
    const tsb = ctl - atl;
    ctl += (load - ctl) / 42;
    atl += (load - atl) / 7;
    out.push({ day, load: round(load)!, ctl: round(ctl)!, atl: round(atl)!, tsb: round(tsb)! });
  }
  return out;
}

// --- Schlaf ----------------------------------------------------------------------------------

/** Hauptschlaf je Tag (längster, kein Nickerchen) plus Summe der Nickerchen. */
export function sleepByDay(sleeps: SleepRow[]) {
  const map = new Map<string, { main: SleepRow; napS: number }>();
  for (const s of sleeps) {
    if (s.is_nap) continue;
    const e = map.get(s.day);
    if (!e) map.set(s.day, { main: s, napS: 0 });
    else if ((s.asleep_s ?? 0) > (e.main.asleep_s ?? 0)) e.main = s;
  }
  for (const s of sleeps) {
    const e = map.get(s.day);
    if (s.is_nap && e) e.napS += s.asleep_s ?? 0;
  }
  return map;
}

// --- Tagesreihe -------------------------------------------------------------------------------

export interface DayPoint {
  day: string;
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  spo2: number | null;
  skinTemp: number | null;
  strain: number | null;
  sleepH: number | null;
  sleepPerf: number | null;
  sleepEff: number | null;
  deepH: number | null;
  remH: number | null;
  respRate: number | null;
  load: number;
  ctl: number;
  atl: number;
  tsb: number;
  workouts: number;
  trainingMin: number;
}

export function daySeries(daily: DailyRow[], sleeps: SleepRow[], workouts: (MergedWorkout & WorkoutLoad)[], load: LoadPoint[], from: string, to: string): DayPoint[] {
  const dailyByDay = new Map<string, DailyRow>();
  for (const d of daily) if (!dailyByDay.has(d.day) || d.recovery_score != null) dailyByDay.set(d.day, d);
  const sleepMap = sleepByDay(sleeps);
  const loadByDay = new Map(load.map((p) => [p.day, p]));
  const out: DayPoint[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const d = dailyByDay.get(day);
    const s = sleepMap.get(day)?.main;
    const l = loadByDay.get(day);
    const ws = workouts.filter((w) => w.day === day);
    out.push({
      day,
      recovery: d?.recovery_score ?? null,
      hrv: round(d?.hrv_ms),
      rhr: round(d?.resting_hr, 0),
      spo2: round(d?.spo2_pct),
      skinTemp: round(d?.skin_temp_c, 2),
      strain: round(d?.strain),
      sleepH: s?.asleep_s != null ? round(s.asleep_s / 3600, 2) : null,
      sleepPerf: s?.performance_pct ?? null,
      sleepEff: round(s?.efficiency_pct),
      deepH: s?.deep_s != null ? round(s.deep_s / 3600, 2) : null,
      remH: s?.rem_s != null ? round(s.rem_s / 3600, 2) : null,
      respRate: round(s?.respiratory_rate),
      load: l?.load ?? 0,
      ctl: l?.ctl ?? 0,
      atl: l?.atl ?? 0,
      tsb: l?.tsb ?? 0,
      workouts: ws.length,
      trainingMin: Math.round(ws.reduce((a, w) => a + (w.duration_s ?? 0), 0) / 60),
    });
  }
  return out;
}

// --- Trends ---------------------------------------------------------------------------------

export interface Trend {
  /** Letzter vorhandener Wert und sein Tag. */
  last: number | null;
  lastDay: string | null;
  /** Mittel der letzten 7 Tage. */
  avg7: number | null;
  /** Persönliche Basis: Mittel und Streuung der 28 Tage davor (Tage −35 … −8). */
  baseline: number | null;
  baselineSd: number | null;
  /** Abweichung des 7-Tage-Mittels von der Basis in Prozent. */
  deltaPct: number | null;
  /** below/above: 7-Tage-Mittel mehr als eine halbe Standardabweichung von der Basis entfernt. */
  status: "below" | "normal" | "above" | "unknown";
}

export function trend(series: DayPoint[], key: keyof DayPoint, today: string): Trend {
  const val = (p: DayPoint) => p[key] as number | null;
  const known = series.filter((p) => p.day <= today && val(p) != null);
  const lastP = known.at(-1);
  const win = (fromOff: number, toOff: number) =>
    nums(series.filter((p) => p.day >= addDays(today, fromOff) && p.day <= addDays(today, toOff)).map(val));
  const recent = win(-6, 0);
  const base = win(-34, -7);
  const avg7 = mean(recent), baseline = base.length >= 7 ? mean(base) : null, baselineSd = base.length >= 7 ? sd(base) : null;
  let status: Trend["status"] = "unknown";
  if (avg7 != null && baseline != null && baselineSd != null) {
    const z = baselineSd > 0 ? (avg7 - baseline) / baselineSd : 0;
    status = z < -0.5 ? "below" : z > 0.5 ? "above" : "normal";
  }
  return {
    last: lastP ? val(lastP) : null,
    lastDay: lastP?.day ?? null,
    avg7: round(avg7, 2),
    baseline: round(baseline, 2),
    baselineSd: round(baselineSd, 2),
    deltaPct: avg7 != null && baseline ? round(((avg7 - baseline) / baseline) * 100) : null,
    status,
  };
}

// --- Wochen ----------------------------------------------------------------------------------

export interface WeekSummary {
  week: string;
  workouts: number;
  trainingH: number;
  load: number;
  distanceKm: number;
  bySport: Record<string, { count: number; minutes: number }>;
  avgRecovery: number | null;
  avgHrv: number | null;
  avgRhr: number | null;
  avgSleepH: number | null;
  avgStrain: number | null;
  sleepDebtH: number | null;
  /** CTL am Ende der Woche (bzw. heute) und Veränderung gegenüber der Vorwoche. */
  ctlEnd: number;
  ctlChange: number;
}

export function weeklySummaries(series: DayPoint[], workouts: (MergedWorkout & WorkoutLoad)[], sleepNeedH: number): WeekSummary[] {
  const weeks = new Map<string, DayPoint[]>();
  for (const p of series) {
    const w = weekStart(p.day);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w)!.push(p);
  }
  const out: WeekSummary[] = [];
  let prevCtl: number | null = null;
  for (const [week, days] of [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const end = addDays(week, 6);
    const ws = workouts.filter((w) => w.day >= week && w.day <= end);
    const bySport: WeekSummary["bySport"] = {};
    for (const w of ws) {
      const k = w.sport ?? "andere";
      bySport[k] ??= { count: 0, minutes: 0 };
      bySport[k].count++;
      bySport[k].minutes += Math.round((w.duration_s ?? 0) / 60);
    }
    const sleepH = nums(days.map((d) => d.sleepH));
    const ctlEnd = days.at(-1)!.ctl;
    out.push({
      week,
      workouts: ws.length,
      trainingH: round(ws.reduce((a, w) => a + (w.duration_s ?? 0), 0) / 3600, 2)!,
      load: round(days.reduce((a, d) => a + d.load, 0))!,
      distanceKm: round(ws.reduce((a, w) => a + (w.distance_m ?? 0), 0) / 1000)!,
      bySport,
      avgRecovery: round(mean(nums(days.map((d) => d.recovery))), 0),
      avgHrv: round(mean(nums(days.map((d) => d.hrv)))),
      avgRhr: round(mean(nums(days.map((d) => d.rhr)))),
      avgSleepH: round(mean(sleepH), 2),
      avgStrain: round(mean(nums(days.map((d) => d.strain)))),
      sleepDebtH: sleepH.length ? round(sleepH.reduce((a, h) => a + (sleepNeedH - h), 0), 1) : null,
      ctlEnd,
      ctlChange: prevCtl == null ? 0 : round(ctlEnd - prevCtl)!,
    });
    prevCtl = ctlEnd;
  }
  return out;
}
