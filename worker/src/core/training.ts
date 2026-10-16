// Trainingsübersicht für Coach und Dashboard: Ziele, Phase, Wochenplan (gespeichert oder
// Vorschlag), Soll/Ist-Abgleich und ob die heutige Einheit zur Tagesform passt.
// Trainingsempfehlungen, keine medizinische Diagnose; Belastungswerte sind Schätzungen.
import { addDays, daysBetween, weekStart, type DayPoint, type EffectiveSettings, type WeekSummary } from "./analysis";
import type { CoachAdvice, Readiness } from "./coach";
import { readGoals, readNotes, readPlan, readPrefs, type CoachNote } from "./goals";
import { projectEvent, type EventProjection } from "./projection";
import {
  PHASE_LABEL,
  buildWeekPlan,
  comparePlan,
  isHard,
  isStrengthSport,
  type ActualDay,
  type Goal,
  type PlanComparison,
  type PlannedSession,
  type TrainingPrefs,
  type WeekPlan,
} from "./plan";

/** Was das Dashboard ohnehin berechnet (Ausschnitt von `buildDashboard`). */
export interface TrainingInputs {
  today: string;
  days: DayPoint[];
  weeks: WeekSummary[];
  workouts: { day: string; sport: string | null; durationMin: number; load: number | null }[];
  settings: Pick<EffectiveSettings, "ftpW" | "thresholdHr" | "maxHr">;
  coach: CoachAdvice;
}

export interface TodayCheck {
  planned: PlannedSession | null;
  /** ok = passt, reduce = leichter machen, swap = tauschen/verschieben, rest = Ruhetag einhalten */
  verdict: "ok" | "reduce" | "swap" | "rest" | "none";
  text: string;
}

const LEVEL: Record<Readiness, number> = { rest: 0, easy: 1, moderate: 2, hard: 3 };
const NEED: Partial<Record<PlannedSession["type"], number>> = {
  rest: 0, strength: 1, recovery: 0, endurance: 1, long: 2, tempo: 2, opener: 1, threshold: 3, vo2max: 3, race: 3,
};

/** Passt die geplante Einheit zur heutigen Bereitschaft? Gibt eine konkrete Anpassung zurück. */
export function todayCheck(planned: PlannedSession | null, advice: CoachAdvice, plan: WeekPlan | null): TodayCheck {
  if (!planned) return { planned: null, verdict: "none", text: "Für heute ist nichts geplant." };
  const need = NEED[planned.type] ?? 1;
  const have = LEVEL[advice.readiness];
  if (planned.type === "rest") {
    return have >= 3
      ? { planned, verdict: "rest", text: "Ruhetag laut Plan. Du bist gut erholt – lockere Bewegung ist okay, aber der Ruhetag hilft der nächsten harten Einheit." }
      : { planned, verdict: "ok", text: "Ruhetag laut Plan – passt zu deiner Tagesform." };
  }
  if (planned.type === "race") return { planned, verdict: "ok", text: `Heute: ${planned.title}. ${have <= 1 ? "Die Werte sind gedämpft – ruhig angehen und nach Gefühl einteilen." : "Viel Erfolg!"}` };
  if (have >= need) {
    let text = `Geplant: ${planned.title} – passt zu deiner Tagesform.`;
    if (planned.strength && have <= 1) text += " Kraft heute eher leicht halten.";
    return { planned, verdict: "ok", text };
  }
  // Nicht genug erholt: Ausweichtag in dieser Woche suchen (nächster lockerer/freier Tag, nicht vor einer harten Einheit).
  const swapWith = plan?.days.find((d, i, all) => d.day > planned.day && (d.type === "endurance" || d.type === "recovery" || d.type === "rest") && !(all[i + 1] && isHard(all[i + 1].type)));
  if (advice.readiness === "rest") {
    return { planned, verdict: "rest", text: `Heute lieber Ruhe statt „${planned.title}“.${swapWith && planned.key ? ` Die Einheit kann auf ${weekdayName(swapWith.day)} rutschen.` : ""}` };
  }
  if (planned.key && swapWith) {
    return { planned, verdict: "swap", text: `„${planned.title}“ heute nicht erzwingen: mit ${weekdayName(swapWith.day)} tauschen und heute locker (Zone 1–2, 45–60 min).` };
  }
  return { planned, verdict: "reduce", text: `„${planned.title}“ heute leichter machen: kürzer und eine Zone niedriger${planned.strength ? ", Kraft nur leicht oder weglassen" : ""}.` };
}

const WD = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const weekdayName = (day: string) => WD[(new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7];

export function actualDays(workouts: TrainingInputs["workouts"], from: string, to: string): ActualDay[] {
  const map = new Map<string, ActualDay>();
  for (const w of workouts) {
    if (w.day < from || w.day > to) continue;
    const a = map.get(w.day) ?? { day: w.day, load: 0, minutes: 0, sports: [], strength: false };
    a.load += w.load ?? 0;
    a.minutes += w.durationMin;
    if (w.sport && !a.sports.includes(w.sport)) a.sports.push(w.sport);
    if (isStrengthSport(w.sport)) a.strength = true;
    map.set(w.day, a);
  }
  return [...map.values()];
}

export interface WeekView {
  week: string;
  stored: boolean;
  savedAt: string | null;
  plan: WeekPlan;
  phaseLabel: string;
  comparison: PlanComparison;
}

/** Plan einer Woche: gespeicherter Plan, sonst Regelvorschlag (nicht gespeichert). */
export async function weekView(db: D1Database, inp: TrainingInputs, week: string, ctx?: { goals: Goal[]; prefs: TrainingPrefs }): Promise<WeekView> {
  const ws = weekStart(week);
  const [goals, prefs, stored] = await Promise.all([ctx?.goals ?? readGoals(db), ctx?.prefs ?? readPrefs(db), readPlan(db, ws)]);
  const plan = stored ?? proposePlan(inp, ws, goals, prefs);
  return {
    week: ws,
    stored: Boolean(stored),
    savedAt: stored?.savedAt ?? null,
    plan,
    phaseLabel: PHASE_LABEL[plan.phase],
    comparison: comparePlan(plan, actualDays(inp.workouts, ws, addDays(ws, 6)), inp.today),
  };
}

export function proposePlan(inp: TrainingInputs, week: string, goals: Goal[], prefs: TrainingPrefs): WeekPlan {
  // Fitness und Form am letzten bekannten Tag vor der Woche (bzw. heute).
  const ref = [...inp.days].reverse().find((d) => d.day <= inp.today && d.day < week) ?? inp.days.at(-1);
  return buildWeekPlan({
    weekStart: week,
    goals,
    prefs,
    weeks: inp.weeks,
    ctl: ref?.ctl ?? 0,
    tsb: ref?.tsb ?? null,
    ftpW: inp.settings.ftpW,
    thresholdHr: inp.settings.thresholdHr,
    maxHr: inp.settings.maxHr,
  });
}

export interface GoalProgress {
  goal: Goal;
  daysLeft: number | null;
  weeksLeft: number | null;
  /** Aktueller Wert der Zielgröße (falls messbar), z. B. CTL oder FTP. */
  current: number | null;
  text: string;
}

export function goalProgress(goals: Goal[], inp: TrainingInputs & { body?: { weightKg: number | null } | null }): GoalProgress[] {
  const todayP = inp.days.find((d) => d.day === inp.today) ?? inp.days.at(-1);
  const lastWeeks = inp.weeks.filter((w) => w.week < weekStart(inp.today)).slice(-4);
  const avgH = lastWeeks.length ? lastWeeks.reduce((a, w) => a + w.trainingH, 0) / lastWeeks.length : null;
  return goals.map((g) => {
    const daysLeft = g.targetDate ? daysBetween(inp.today, g.targetDate) : null;
    let current: number | null = null;
    switch (g.metric) {
      case "ctl": current = todayP?.ctl ?? null; break;
      case "ftpW": current = inp.settings.ftpW; break;
      case "weightKg": current = inp.body?.weightKg ?? null; break;
      case "weeklyHours": current = avgH != null ? Number(avgH.toFixed(1)) : null; break;
    }
    const parts: string[] = [];
    if (daysLeft != null) parts.push(daysLeft >= 0 ? `noch ${daysLeft} Tage` : `vor ${-daysLeft} Tagen`);
    if (current != null && g.targetValue != null) parts.push(`aktuell ${current}${g.unit ? " " + g.unit : ""} von ${g.targetValue}${g.unit ? " " + g.unit : ""}`);
    return { goal: g, daysLeft, weeksLeft: daysLeft != null ? Math.floor(daysLeft / 7) : null, current, text: parts.join(", ") };
  });
}

export interface TrainingOverview {
  goals: GoalProgress[];
  prefs: TrainingPrefs;
  thisWeek: WeekView;
  nextWeek: { week: string; stored: boolean; phase: WeekPlan["phase"]; phaseLabel: string; phaseReason: string };
  today: TodayCheck;
  /** Formprognose bis zum nächsten Terminziel (null ohne Termin). */
  projection: EventProjection | null;
  notes: CoachNote[];
  disclaimer: string;
}

export async function trainingOverview(db: D1Database, inp: TrainingInputs & { body?: { weightKg: number | null } | null }): Promise<TrainingOverview> {
  const [goals, prefs, notes] = await Promise.all([readGoals(db), readPrefs(db), readNotes(db, { fromDay: addDays(inp.today, -14), limit: 10 })]);
  const thisWeek = await weekView(db, inp, inp.today, { goals, prefs });
  const nextWs = addDays(weekStart(inp.today), 7);
  const nextStored = await readPlan(db, nextWs);
  const next = nextStored ?? proposePlan(inp, nextWs, goals, prefs);
  const planned = thisWeek.plan.days.find((d) => d.day === inp.today) ?? null;
  const projection = eventProjection(inp, goals, prefs, thisWeek.plan);
  return {
    goals: goalProgress(goals, inp),
    prefs,
    thisWeek,
    nextWeek: { week: nextWs, stored: Boolean(nextStored), phase: next.phase, phaseLabel: PHASE_LABEL[next.phase], phaseReason: next.phaseReason },
    today: todayCheck(planned, inp.coach, thisWeek.plan),
    projection,
    notes,
    disclaimer: "Trainingsplan und Belastungen sind Schätzungen nach Faustregeln, keine medizinische Beratung. Bei Schmerzen oder Krankheit pausieren.",
  };
}

/** Prognose ab dem Stand von gestern, mit dem Plan der laufenden Woche. */
export function eventProjection(inp: TrainingInputs, goals: Goal[], prefs: TrainingPrefs, currentPlan: WeekPlan | null, goalId?: number): EventProjection | null {
  const y = inp.days.find((d) => d.day === addDays(inp.today, -1));
  const t = inp.days.find((d) => d.day === inp.today);
  return projectEvent({
    today: inp.today,
    ctl: y?.ctl ?? 0,
    atl: y?.atl ?? 0,
    todayLoad: t?.load ?? 0,
    goals,
    prefs,
    weeks: inp.weeks,
    currentPlan,
    ftpW: inp.settings.ftpW,
    thresholdHr: inp.settings.thresholdHr,
    maxHr: inp.settings.maxHr,
    goalId,
  });
}
