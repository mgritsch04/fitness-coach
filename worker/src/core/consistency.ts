// Konstanz und Serien (#209): Wochen mit erreichtem Trainingsziel (Kraft- und Radeinheiten),
// aktuelle und beste Serie, Quote der letzten 12 Wochen und Plan-Treue (geplant gegen absolviert).
// Regelmäßigkeit zählt mehr als Einzelleistung. Geschätzte Ziele sind als solche gekennzeichnet.
import { addDays, weekStart } from "./analysis";
import { isStrengthSport } from "./plan";
import { isRide } from "./records";

export const CONSISTENCY_WEEKS = 12;
/** Kürzere Fahrten zählen nicht als Radeinheit (Ein-/Ausrollen, Testfahrten). */
const MIN_RIDE_MIN = 20;

export interface ConsistencyWorkout { day: string; sport: string | null; durationMin: number }
export interface WeekPlanCount { week: string; planned: number; done: number }

export interface ConsistencyTarget {
  strength: number;
  rides: number;
  /** prefs = selbst eingetragen, estimate = Median der letzten abgeschlossenen Wochen */
  strengthSource: "prefs" | "estimate";
  ridesSource: "prefs" | "estimate";
}

export interface ConsistencyWeek {
  week: string;
  strength: number;
  rides: number;
  met: boolean;
  /** laufende Woche: zählt erst, wenn das Ziel erreicht ist */
  current: boolean;
  planned: number | null;
  done: number | null;
}

export interface Consistency {
  target: ConsistencyTarget;
  weeks: ConsistencyWeek[];
  streak: number;
  bestStreak: number;
  /** erreichte / abgeschlossene Wochen der letzten 12 (Prozent) */
  ratePct: number | null;
  /** absolvierte / geplante Einheiten aus gespeicherten Plänen (Prozent) */
  planAdherencePct: number | null;
  text: string;
  note: string;
}

/** Kraft zählt je Tag einmal (mehrere Quellen derselben Einheit), Rad je Fahrt ab 20 min. */
export function weekCounts(workouts: ConsistencyWorkout[], week: string) {
  const end = addDays(week, 6);
  const strengthDays = new Set<string>();
  let rides = 0;
  for (const w of workouts) {
    if (w.day < week || w.day > end) continue;
    if (isStrengthSport(w.sport)) strengthDays.add(w.day);
    else if (isRide(w.sport) && w.durationMin >= MIN_RIDE_MIN) rides++;
  }
  return { strength: strengthDays.size, rides };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function consistencyTarget(
  completed: { strength: number; rides: number }[],
  prefs: { strengthPerWeek?: number | null; ridesPerWeek?: number | null },
): ConsistencyTarget {
  // Schätzung aus den letzten 8 abgeschlossenen Wochen; mindestens 1, damit eine leere Woche nie „erreicht“ ist.
  const recent = completed.slice(-8);
  const est = (k: "strength" | "rides") => Math.max(1, Math.round(median(recent.map((w) => w[k]))));
  return {
    strength: prefs.strengthPerWeek ?? est("strength"),
    rides: prefs.ridesPerWeek ?? est("rides"),
    strengthSource: prefs.strengthPerWeek != null ? "prefs" : "estimate",
    ridesSource: prefs.ridesPerWeek != null ? "prefs" : "estimate",
  };
}

export function consistency(inp: {
  today: string;
  workouts: ConsistencyWorkout[];
  prefs: { strengthPerWeek?: number | null; ridesPerWeek?: number | null };
  plans?: WeekPlanCount[];
}): Consistency {
  const cur = weekStart(inp.today);
  const weekList = Array.from({ length: CONSISTENCY_WEEKS }, (_, i) => addDays(cur, -7 * (CONSISTENCY_WEEKS - 1 - i)));
  const counts = weekList.map((w) => ({ week: w, ...weekCounts(inp.workouts, w) }));
  // Erst ab der ersten Woche mit Einheiten schätzen, sonst ziehen leere Wochen vor der Aufzeichnung das Ziel auf 0.
  const firstActive = counts.findIndex((w) => w.strength + w.rides > 0);
  const target = consistencyTarget(firstActive < 0 ? [] : counts.slice(firstActive, -1), inp.prefs);
  const plans = new Map((inp.plans ?? []).map((p) => [p.week, p]));
  const weeks: ConsistencyWeek[] = counts.map((c) => ({
    ...c,
    met: c.strength >= target.strength && c.rides >= target.rides,
    current: c.week === cur,
    planned: plans.get(c.week)?.planned ?? null,
    done: plans.get(c.week)?.done ?? null,
  }));

  // Serie bis zur letzten abgeschlossenen Woche; die laufende Woche verlängert sie nur, wenn schon erreicht.
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].met) streak++;
    else if (weeks[i].current) continue;
    else break;
  }
  let best = 0, run = 0;
  for (const w of weeks) {
    if (w.met) best = Math.max(best, ++run);
    else if (!w.current) run = 0;
  }
  // Ohne Daten vor dem Beginn der Aufzeichnung keine Quote über leere Wochen.
  const closed = firstActive < 0 ? [] : weeks.slice(firstActive).filter((w) => !w.current);
  const ratePct = closed.length ? Math.round((closed.filter((w) => w.met).length / closed.length) * 100) : null;
  const withPlan = weeks.filter((w) => w.planned);
  const planned = withPlan.reduce((s, w) => s + (w.planned ?? 0), 0), done = withPlan.reduce((s, w) => s + (w.done ?? 0), 0);
  const planAdherencePct = planned ? Math.round((done / planned) * 100) : null;

  const goal = `${target.strength}× Kraft + ${target.rides}× Rad`;
  const now = weeks.at(-1)!;
  const left = [
    now.strength < target.strength ? `${target.strength - now.strength}× Kraft` : null,
    now.rides < target.rides ? `${target.rides - now.rides}× Rad` : null,
  ].filter(Boolean);
  let text: string;
  if (firstActive < 0) text = "Noch keine Einheiten in den letzten 12 Wochen.";
  else {
    text = streak >= 2 ? `${streak} Wochen in Folge ${goal}.` : streak === 1 ? `Letzte Woche ${goal} geschafft.` : `Wochenziel ${goal} zuletzt nicht erreicht.`;
    text += now.met ? " Diese Woche ist schon erreicht." : ` Diese Woche fehlen noch ${left.join(" und ")}.`;
    if (best > streak) text += ` Beste Serie: ${best} Wochen.`;
  }
  const estimated = target.strengthSource === "estimate" || target.ridesSource === "estimate";
  return {
    target, weeks, streak, bestStreak: best, ratePct, planAdherencePct, text,
    note: `Kraft zählt einmal pro Tag, Rad ab ${MIN_RIDE_MIN} min.${estimated ? " Wochenziel geschätzt aus den letzten Wochen; ändern über die Trainingsvorlieben (strengthPerWeek, ridesPerWeek)." : ""}`,
  };
}
