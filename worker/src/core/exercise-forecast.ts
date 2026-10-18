// Prognose je Übung (#328): Trend des geschätzten 1RM fortgeschrieben, ehrlich „keine Prognose“ bei Plateau oder zu wenig Daten.
import { addDays } from "./analysis";
import type { ExerciseProgress } from "./strength";

export interface ExerciseForecast {
  available: boolean;
  /** Grund, falls keine Prognose (zu wenig Daten, Plateau, Rückgang). */
  reason: string | null;
  weeks: number;
  /** Geschätztes 1RM heute (Trendlinie) und Zuwachs je Woche in kg. */
  currentKg: number | null;
  perWeekKg: number | null;
  /** Wöchentliche Punkte ab heute, gestrichelt im Diagramm. */
  points: { day: string; e1rmKg: number }[];
  targetKg: number | null;
  /** Gewicht für die Wiederholungen des letzten Top-Satzes bei targetKg (auf 2,5 kg gerundet). */
  target: { reps: number; weightKg: number } | null;
  text: string;
}

const LOOKBACK_DAYS = 84;
/** Obergrenze des fortgeschriebenen Zuwachses: 1,5 % des aktuellen Werts je Woche (Fortschritt flacht meist ab). */
const MAX_GAIN_PER_WEEK = 0.015;
const MIN_GAIN_PER_WEEK = 0.002;
const r1 = (v: number) => Math.round(v * 10) / 10;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function exerciseForecast(p: ExerciseProgress, today: string, weeks = 8): ExerciseForecast {
  const none = (reason: string): ExerciseForecast => ({ available: false, reason, weeks, currentKg: null, perWeekKg: null, points: [], targetKg: null, target: null, text: reason });
  const pts = p.history.filter((h) => h.e1rmKg != null && h.day >= addDays(today, -LOOKBACK_DAYS + 1) && h.day <= today);
  if (pts.length < 3 || daysBetween(pts[0].day, pts.at(-1)!.day) < 14)
    return none("Zu wenig Daten für eine Prognose (mindestens 3 Einheiten über 2 Wochen in den letzten 12 Wochen).");
  if (p.status === "decline") return none("Zuletzt Rückgang, daher keine Prognose. Erholung und Schlaf prüfen.");
  if (p.status === "plateau") return none("Plateau: kein Aufwärtstrend, daher keine Prognose.");

  // Lineare Regression e1RM über Tage.
  const xs = pts.map((h) => daysBetween(pts[0].day, h.day)), ys = pts.map((h) => h.e1rmKg!);
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const tNow = daysBetween(pts[0].day, today);
  const current = Math.max(0, my + slope * (Math.min(tNow, xs.at(-1)!) - mx));
  const rawWeek = slope * 7;
  if (!(current > 0) || rawWeek < current * MIN_GAIN_PER_WEEK) return none("Kein klarer Aufwärtstrend, daher keine Prognose.");
  const perWeek = Math.min(rawWeek, current * MAX_GAIN_PER_WEEK);
  const points = Array.from({ length: weeks }, (_, k) => ({ day: addDays(today, 7 * (k + 1)), e1rmKg: r1(current + perWeek * (k + 1)) }));
  const targetKg = points.at(-1)!.e1rmKg;
  const reps = Math.min(12, Math.max(1, p.history.at(-1)!.topSet.reps));
  const weightKg = Math.round(targetKg / (1 + (reps === 1 ? 0 : reps / 30)) / 2.5) * 2.5;
  const de = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  const capped = perWeek < rawWeek ? " Zuwachs auf 1,5 % je Woche begrenzt, weil Fortschritt meist abflacht." : "";
  return {
    available: true,
    reason: null,
    weeks,
    currentKg: r1(current),
    perWeekKg: r1(perWeek),
    points,
    targetKg,
    target: { reps, weightKg },
    text: `Bei gleichem Tempo in ${weeks} Wochen etwa ${de(targetKg)} kg geschätztes Maximum (jetzt ≈ ${de(r1(current))} kg), das wären ${reps} × ${de(weightKg)} kg. Schätzung aus dem Trend der letzten 12 Wochen.${capped}`,
  };
}
