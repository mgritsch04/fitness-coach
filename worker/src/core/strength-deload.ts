// Kraft-Plateau erkennen und Entlastungswoche vorschlagen (#202): je Grundübung das beste geschätzte 1RM
// der letzten 3 Wochen gegen die 3 Wochen davor; „Plateau“ bei ± 2 %, „Rückgang“ ab −5 %. Steigt dabei die
// Anstrengung (RPE), wird es eng. Stagnieren mehrere Grundübungen, bringt eine leichte Woche mehr als
// noch härteres Training. Reine Funktion; 1RM nach Epley, alles Schätzungen und Trainingsempfehlungen.
import { addDays } from "./analysis";
import { estimate1RM, exerciseName, type StrengthSession } from "./strength";

/** Grundübungen, an denen sich ein Plateau ablesen lässt (Isolationsübungen schwanken zu stark). */
export const COMPOUND = ["back_squat", "front_squat", "leg_press", "deadlift", "romanian_deadlift", "hip_thrust", "bench_press", "incline_bench_press", "overhead_press", "pull_up", "barbell_row", "dip"];

export interface ExerciseTrend {
  exercise: string;
  name: string;
  status: "progress" | "plateau" | "decline";
  /** Bestes e1RM letzte 3 Wochen gegen die 3 Wochen davor, in Prozent. */
  changePct: number;
  recentE1rmKg: number;
  /** Mittlere RPE letzte 3 Wochen minus die 3 Wochen davor (null ohne RPE). */
  rpeChange: number | null;
}

export interface StrengthDeload {
  verdict: "deload" | "watch" | "ok" | "insufficient";
  exercises: ExerciseTrend[];
  /** Vorschlag für eine Entlastungswoche (nur bei verdict = deload). */
  suggestion: { weeks: number; volumePct: number; weightPct: number; text: string } | null;
  text: string;
  note: string;
}

const NOTE = "Plateau = bestes geschätztes 1RM (Epley) der letzten 3 Wochen innerhalb ± 2 % der 3 Wochen davor. Schätzung, Trainingsempfehlung.";
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (v: number) => `${v > 0 ? "+" : ""}${String(Math.round(v * 10) / 10).replace(".", ",")} %`;

export function strengthDeload(sessions: StrengthSession[], today: string): StrengthDeload {
  const recentFrom = addDays(today, -20), priorFrom = addDays(today, -41);
  const trends: ExerciseTrend[] = [];
  for (const ex of COMPOUND) {
    const rows = sessions
      .filter((s) => s.day >= priorFrom && s.day <= today)
      .flatMap((s) => s.sets.filter((x) => x.exercise === ex).map((x) => ({ day: s.day, e1rm: estimate1RM(x.weightKg, x.reps), rpe: x.rpe ?? s.rpe ?? null })));
    const recent = rows.filter((r) => r.day >= recentFrom), prior = rows.filter((r) => r.day < recentFrom);
    // Mindestens zwei Einheiten je Zeitraum, sonst ist der Vergleich Zufall.
    if (new Set(recent.map((r) => r.day)).size < 2 || new Set(prior.map((r) => r.day)).size < 2) continue;
    const best = (xs: typeof rows) => Math.max(...xs.flatMap((r) => (r.e1rm != null ? [r.e1rm] : [])));
    const r = best(recent), p = best(prior);
    if (!Number.isFinite(r) || !Number.isFinite(p) || p <= 0) continue;
    const changePct = Math.round(((r - p) / p) * 1000) / 10;
    const rpeR = mean(recent.flatMap((x) => (x.rpe != null ? [x.rpe] : []))), rpeP = mean(prior.flatMap((x) => (x.rpe != null ? [x.rpe] : [])));
    trends.push({
      exercise: ex,
      name: exerciseName(ex),
      status: changePct <= -5 ? "decline" : changePct <= 2 ? "plateau" : "progress",
      changePct,
      recentE1rmKg: r,
      rpeChange: rpeR != null && rpeP != null ? Math.round((rpeR - rpeP) * 10) / 10 : null,
    });
  }
  if (trends.length < 2)
    return { verdict: "insufficient", exercises: trends, suggestion: null, note: NOTE,
      text: "Für eine Plateau-Einschätzung braucht es mindestens zwei Grundübungen mit je zwei Einheiten in den letzten 3 und den 3 Wochen davor." };

  const stuck = trends.filter((t) => t.status !== "progress");
  const harder = stuck.filter((t) => t.status === "decline" || (t.rpeChange != null && t.rpeChange >= 0.5));
  const declines = trends.filter((t) => t.status === "decline");
  // Entlastung: mehrere Grundübungen stagnieren bei steigender Anstrengung, oder zwei gehen deutlich zurück,
  // oder fast alles stagniert (≥ 2 und ≥ 2/3 der Übungen).
  const deload = harder.length >= 2 || declines.length >= 2 || (stuck.length >= 2 && stuck.length / trends.length >= 2 / 3);
  const list = (xs: ExerciseTrend[]) => xs.map((t) => `${t.name} ${pct(t.changePct)}`).join(", ");
  if (deload)
    return {
      verdict: "deload",
      exercises: trends,
      suggestion: { weeks: 1, volumePct: -40, weightPct: -10, text: "Eine Woche leichter: etwa 40 % weniger Sätze, Gewichte etwa 10 % runter, Technik sauber, nichts bis zum Versagen. Danach mit den alten Gewichten weiter, meist geht es dann wieder voran." },
      text: `Kraft stagniert bei mehreren Grundübungen (${list(stuck)})${harder.some((t) => t.rpeChange != null && t.rpeChange >= 0.5) ? " und die Anstrengung steigt" : ""}. Eine Entlastungswoche bringt jetzt mehr als noch härteres Training.`,
      note: NOTE,
    };
  if (stuck.length)
    return { verdict: "watch", exercises: trends, suggestion: null, note: NOTE,
      text: `Stagniert: ${list(stuck)}. Noch kein Grund für eine Entlastungswoche; auf Schlaf und Wiederholungsbereich achten.` };
  return { verdict: "ok", exercises: trends, suggestion: null, note: NOTE, text: `Grundübungen gehen voran (${list(trends)}).` };
}
