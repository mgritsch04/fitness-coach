// Erholungs-Prognose (#93): Schätzung der WHOOP-Erholung für morgen früh aus der Erholung heute, der Belastung
// und dem Strain des Tages, dem geplanten Schlaf und spätem Training. Kleine Ridge-Regression nur auf den eigenen
// letzten 90 Tagen; die Güte wird ehrlich per Leave-one-out geprüft und bei zu wenig Daten oder zu großem Fehler
// gibt es keine Prognose. Reine Funktionen ohne D1.
import { addDays, type DayPoint } from "./analysis";
import { localMinutes } from "./performance";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Merkmale des Vortags (bzw. der Nacht davor) für die Erholung am Morgen. */
export const FEATURES = ["recoveryPrev", "load", "strain", "sleepH", "late"] as const;
export type Feature = (typeof FEATURES)[number];
export type Features = Record<Feature, number>;

export const FEATURE_LABELS: Record<Feature, string> = {
  recoveryPrev: "Erholung am Vortag",
  load: "Trainingsbelastung am Vortag",
  strain: "WHOOP-Strain am Vortag",
  sleepH: "Schlaf in der Nacht",
  late: "Training nach 19 Uhr am Vortag",
};

export const MIN_OBS = 30;
/** Mittlerer Fehler (Prozentpunkte), ab dem die Prognose nicht mehr gezeigt wird. */
export const MAX_MAE = 18;
const LAMBDA = 2;
/** 80-%-Spanne aus der Normalverteilung der Fehler (Schätzung). */
const Z80 = 1.28;

export interface Obs {
  day: string;
  x: Features;
  y: number;
}

/** Tage mit Training, das nach 19 Uhr (lokal) endete. */
export function lateTrainingDays(workouts: readonly { day: string; end_time: string }[], timeZone: string) {
  const late = new Set<string>();
  for (const w of workouts) {
    const m = localMinutes(w.end_time, timeZone);
    if (m != null && m >= 19 * 60) late.add(w.day);
  }
  return late;
}

/** Beobachtungen: Erholung an Tag D gegen Merkmale von D−1 und den Schlaf, der am Morgen von D endet. */
export function observations(series: readonly DayPoint[], late: ReadonlySet<string>, fromDay: string, toDay: string): Obs[] {
  const byDay = new Map(series.map((p) => [p.day, p]));
  const out: Obs[] = [];
  for (const p of series) {
    if (p.day < fromDay || p.day > toDay || p.recovery == null || p.sleepH == null) continue;
    const prev = byDay.get(addDays(p.day, -1));
    if (!prev || prev.recovery == null || prev.strain == null) continue;
    out.push({ day: p.day, y: p.recovery, x: { recoveryPrev: prev.recovery, load: prev.load, strain: prev.strain, sleepH: p.sleepH, late: late.has(prev.day) ? 1 : 0 } });
  }
  return out;
}

export interface Model {
  intercept: number;
  /** Steigung je Einheit des Merkmals (Erholungspunkte pro Stunde Schlaf, pro Belastungspunkt …). */
  coef: Features;
  n: number;
}

/** Lineares Gleichungssystem A·x = b (Gauß mit Pivotsuche); A ist hier klein (5×5) und durch Ridge regulär. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

/** Ridge-Regression auf standardisierten Merkmalen (Achsenabschnitt nicht bestraft), zurückgerechnet in echte Einheiten. */
export function fit(obs: readonly Obs[], lambda = LAMBDA): Model {
  const n = obs.length, p = FEATURES.length;
  const mu = FEATURES.map((f) => mean(obs.map((o) => o.x[f])));
  const sd = FEATURES.map((f, j) => Math.sqrt(mean(obs.map((o) => (o.x[f] - mu[j]) ** 2))));
  const yMean = mean(obs.map((o) => o.y));
  // Konstante Merkmale (z. B. nie spät trainiert) bekommen Steigung 0.
  const Z = obs.map((o) => FEATURES.map((f, j) => (sd[j] > 1e-9 ? (o.x[f] - mu[j]) / sd[j] : 0)));
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Z.reduce((a, z) => a + z[i] * z[j], 0) + (i === j ? lambda : 0)));
  const b = Array.from({ length: p }, (_, i) => Z.reduce((a, z, k) => a + z[i] * (obs[k].y - yMean), 0));
  const beta = solve(A, b);
  const coef = Object.fromEntries(FEATURES.map((f, j) => [f, sd[j] > 1e-9 ? beta[j] / sd[j] : 0])) as Features;
  const intercept = yMean - FEATURES.reduce((a, f, j) => a + coef[f] * mu[j], 0);
  return { intercept, coef, n };
}

export const predict = (m: Model, x: Features) => m.intercept + FEATURES.reduce((a, f) => a + m.coef[f] * x[f], 0);

/** Leave-one-out: jede Beobachtung mit einem Modell ohne sie vorhersagen. Ehrlicher als der Fehler auf den Trainingsdaten. */
export function crossValidate(obs: readonly Obs[]) {
  const preds = obs.map((o, i) => clamp(predict(fit(obs.filter((_, k) => k !== i)), o.x), 0, 100));
  const err = preds.map((p, i) => p - obs[i].y);
  const mae = mean(err.map(Math.abs));
  const rmse = Math.sqrt(mean(err.map((e) => e * e)));
  // Vergleich: einfach den eigenen Mittelwert raten bzw. „morgen wie heute“.
  const yMean = mean(obs.map((o) => o.y));
  const maeMean = mean(obs.map((o) => Math.abs(o.y - yMean)));
  const maeSame = mean(obs.map((o) => Math.abs(o.y - o.x.recoveryPrev)));
  return { preds, mae, rmse, maeMean, maeSame };
}

/** Wie viel Strain ein Belastungspunkt ungefähr bringt (einfache Regression über die Historie), für „Was wäre wenn“. */
export function strainPerLoad(obs: readonly Obs[]) {
  const xs = obs.map((o) => o.x.load), ys = obs.map((o) => o.x.strain);
  if (xs.length < 5) return 0.05;
  const mx = mean(xs), my = mean(ys);
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slope = sxx ? xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx : 0;
  return clamp(slope, 0, 0.2);
}

export interface ForecastInput {
  /** Geplanter Schlaf heute Nacht in Stunden. Standard: Median der letzten 14 Nächte. */
  sleepH?: number;
  /** Zusätzliche Belastung, die heute noch geplant ist (TSS-ähnliche Punkte, gilt als Training am Abend). */
  extraLoad?: number;
}

export function recoveryForecast(series: readonly DayPoint[], late: ReadonlySet<string>, today: string, input: ForecastInput = {}) {
  const tomorrow = addDays(today, 1);
  const obs = observations(series, late, addDays(today, -89), today);
  const todayPt = series.find((p) => p.day === today) ?? null;
  const recentSleep = series.filter((p) => p.day > addDays(today, -14) && p.day <= today && p.sleepH != null).map((p) => p.sleepH!);
  const typicalSleepH = round(median(recentSleep), 1);
  const notes = [
    "Schätzung aus deinen eigenen Daten der letzten 90 Tage (lineares Modell). Keine Diagnose; Krankheit, Alkohol, Stress oder Reisen kennt das Modell nicht.",
    "Belastung und Strain von heute zählen so, wie sie gerade erfasst sind. Abends ist die Prognose daher am genauesten.",
  ];
  const base = { today, tomorrow, observations: obs.length, typicalSleepH, notes };

  if (obs.length < MIN_OBS)
    return { ...base, available: false as const, reason: `Noch zu wenige Tage mit Erholung, Strain und Schlaf (${obs.length} von mindestens ${MIN_OBS}).` };
  const cv = crossValidate(obs);
  const quality = {
    maePct: round(cv.mae, 1)!, rmsePct: round(cv.rmse, 1)!,
    maeIfGuessingAverage: round(cv.maeMean, 1)!, maeIfSameAsToday: round(cv.maeSame, 1)!,
    /** Letzte 14 Tage: was das Modell (ohne den jeweiligen Tag zu kennen) geschätzt hätte und was es wurde. */
    recent: obs.map((o, i) => ({ day: o.day, actual: o.y, predicted: round(cv.preds[i])! })).slice(-14),
  };
  if (cv.mae > MAX_MAE || cv.mae >= cv.maeMean)
    return { ...base, available: false as const, quality, reason: `Das Modell trifft deine Erholung bisher nicht gut genug (mittlerer Fehler ${String(quality.maePct).replace(".", ",")} Punkte, kaum besser als raten). Keine Prognose.` };
  if (todayPt?.recovery == null || todayPt.strain == null)
    return { ...base, available: false as const, quality, reason: "Für heute fehlen noch Erholung oder Strain von WHOOP." };

  const model = fit(obs);
  const spl = strainPerLoad(obs);
  const sleepH = input.sleepH ?? typicalSleepH ?? mean(obs.map((o) => o.x.sleepH));
  const extra = input.extraLoad ?? 0;
  const xOf = (sleep: number, add: number): Features => ({
    recoveryPrev: todayPt.recovery!, load: todayPt.load + add, strain: Math.min(21, todayPt.strain! + add * spl), sleepH: sleep,
    late: late.has(today) || add > 0 ? 1 : 0,
  });
  const half = Z80 * cv.rmse;
  const at = (x: Features) => {
    const v = clamp(predict(model, x), 0, 100);
    return { recovery: Math.round(v), low: Math.round(clamp(v - half, 0, 100)), high: Math.round(clamp(v + half, 0, 100)) };
  };
  const main = at(xOf(sleepH, extra));
  const zone = (v: number) => (v >= 67 ? "green" : v >= 34 ? "yellow" : "red");
  const scenario = (label: string, x: Features) => {
    const r = at(x);
    return { label, ...r, delta: r.recovery - main.recovery };
  };
  const scenarios = [
    scenario("1 Stunde mehr Schlaf", xOf(sleepH + 1, extra)),
    scenario("1 Stunde weniger Schlaf", xOf(Math.max(3, sleepH - 1), extra)),
    extra > 0 ? scenario("Kein Training mehr heute Abend", xOf(sleepH, 0)) : scenario("Noch 1 h lockeres Training heute Abend (etwa 50 Punkte)", xOf(sleepH, 50)),
  ];
  return {
    ...base,
    available: true as const,
    assumptions: { sleepH: round(sleepH, 1)!, sleepFromInput: input.sleepH != null, extraLoad: extra, todayRecovery: todayPt.recovery, todayLoad: Math.round(todayPt.load), todayStrain: round(todayPt.strain, 1), lateTraining: xOf(sleepH, extra).late === 1 },
    forecast: { ...main, zone: zone(main.recovery) },
    scenarios,
    /** Wirkung je Einheit laut Modell (Erholungspunkte); Zusammenhänge, keine Ursachen. */
    effects: {
      perSleepHour: round(model.coef.sleepH, 1), per10Load: round(model.coef.load * 10, 1), perStrainPoint: round(model.coef.strain, 1),
      perRecoveryPoint: round(model.coef.recoveryPrev, 2), lateTraining: round(model.coef.late, 1),
    },
    quality,
  };
}
