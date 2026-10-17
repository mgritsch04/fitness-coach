// Trainingsübersicht für Coach und Dashboard: Ziele, Phase, Wochenplan (gespeichert oder
// Vorschlag), Soll/Ist-Abgleich und ob die heutige Einheit zur Tagesform passt.
// Trainingsempfehlungen, keine medizinische Diagnose; Belastungswerte sind Schätzungen.
import { addDays, daysBetween, weekStart, type DayPoint, type EffectiveSettings, type WeekSummary } from "./analysis";
import type { CoachAdvice, Readiness } from "./coach";
import { readGoals, readNotes, readPlan, readPrefs, type CoachNote } from "./goals";
import { readFtpTests, ftpTestSuggestion } from "./ftp-test";
import { FUELING_NOTE, fuelingFor, type Fueling } from "./fueling";
import { makeUpPlan, type MakeUpPlan } from "./make-up";
import { blockView, buildBlock, readBlock, type BlockView, type TrainingBlock } from "./periodization";
import { readStrengthSessions } from "./strength";
import { strengthDeload, type StrengthDeload } from "./strength-deload";
import { STRENGTH_PLAN_NOTE, strengthWorkout, type StrengthWorkout } from "./strength-plan";
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
  workouts: { day: string; sport: string | null; durationMin: number; load: number | null; avgHr?: number | null }[];
  settings: Pick<EffectiveSettings, "ftpW" | "thresholdHr" | "maxHr"> & Partial<Pick<EffectiveSettings, "origin">>;
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
export async function weekView(db: D1Database, inp: TrainingInputs, week: string, ctx?: { goals: Goal[]; prefs: TrainingPrefs; block?: TrainingBlock | null }): Promise<WeekView> {
  const ws = weekStart(week);
  const [goals, prefs, stored, block] = await Promise.all([
    ctx?.goals ?? readGoals(db), ctx?.prefs ?? readPrefs(db), readPlan(db, ws),
    ctx && "block" in ctx ? ctx.block ?? null : readBlock(db, inp.today).catch(() => null),
  ]);
  const plan = stored ?? proposePlan(inp, ws, goals, prefs, block);
  return {
    week: ws,
    stored: Boolean(stored),
    savedAt: stored?.savedAt ?? null,
    plan,
    phaseLabel: PHASE_LABEL[plan.phase],
    comparison: comparePlan(plan, actualDays(inp.workouts, ws, addDays(ws, 6)), inp.today),
  };
}

/** Blockvorschlag ab dieser Woche mit der Fitness von gestern. */
export function proposeBlock(inp: TrainingInputs): TrainingBlock {
  const ref = [...inp.days].reverse().find((d) => d.day < inp.today) ?? inp.days.at(-1);
  return buildBlock(inp.today, ref?.ctl ?? 0);
}

/** Warnzeichen aus der Tagesempfehlung (Frühwarnung), die eine Entlastung im Block vorziehen. */
export const blockWarning = (inp: TrainingInputs) => inp.coach.reasons.find((r) => r.factor === "warning")?.text ?? null;

/** Blockwoche (angepasst an Ist-Werte und Warnzeichen) für den Wochenplan. */
export function blockWeekFor(inp: TrainingInputs, block: TrainingBlock | null | undefined, week: string) {
  if (!block) return null;
  const w = blockView(block, inp.weeks, inp.today, blockWarning(inp)).weeks.find((x) => x.week === weekStart(week));
  return w ? { targetLoad: w.targetLoad, deload: w.deload, label: `Block Woche ${w.index + 1}${w.deload ? " (Entlastung)" : ""}` } : null;
}

export function proposePlan(inp: TrainingInputs, week: string, goals: Goal[], prefs: TrainingPrefs, block?: TrainingBlock | null): WeekPlan {
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
    block: blockWeekFor(inp, block, week),
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
  /** Liegen die Ausdauer-Einheiten im geplanten Pulsbereich? (null ohne Pulsdaten) */
  intensity: IntensityCheck | null;
  /** FTP-Test fällig? Mit vorgeschlagenem Tag aus dem Plan (null, wenn kein Test nötig). */
  ftpTest: FtpTestPlan | null;
  /** Ausgefallene Schlüsseleinheit: Tag zum Nachholen oder Rat, sie ausfallen zu lassen (null, wenn nichts ausfiel). */
  makeUp: MakeUpPlan | null;
  /** 4-Wochen-Block (#206): gespeichert oder Vorschlag ab dieser Woche. */
  block: BlockView & { saved: boolean };
  /** Kraft-Plateau: Entlastungswoche empfohlen? (#202) */
  strengthDeload: StrengthDeload;
  /** Konkrete Krafteinheiten (Übungen, Sätze, Gewicht) für die Plantage ab heute. */
  strengthWorkouts: { days: StrengthWorkout[]; note: string };
  /** Verpflegung je Tag der laufenden Woche (Faustregeln), dazu ein Hinweis. */
  fueling: { days: Fueling[]; note: string };
  disclaimer: string;
}

export async function trainingOverview(db: D1Database, inp: TrainingInputs & { body?: { weightKg: number | null } | null }): Promise<TrainingOverview> {
  const [goals, prefs, notes, savedBlock] = await Promise.all([readGoals(db), readPrefs(db), readNotes(db, { fromDay: addDays(inp.today, -14), limit: 10 }), readBlock(db, inp.today).catch(() => null)]);
  const thisWeek = await weekView(db, inp, inp.today, { goals, prefs, block: savedBlock });
  const nextWs = addDays(weekStart(inp.today), 7);
  const nextStored = await readPlan(db, nextWs);
  const next = nextStored ?? proposePlan(inp, nextWs, goals, prefs, savedBlock);
  const planned = thisWeek.plan.days.find((d) => d.day === inp.today) ?? null;
  const projection = eventProjection(inp, goals, prefs, thisWeek.plan);
  const [tests, sessions] = await Promise.all([readFtpTests(db).catch(() => []), readStrengthSessions(db, addDays(inp.today, -120)).catch(() => [])]);
  return {
    goals: goalProgress(goals, inp),
    prefs,
    thisWeek,
    nextWeek: { week: nextWs, stored: Boolean(nextStored), phase: next.phase, phaseLabel: PHASE_LABEL[next.phase], phaseReason: next.phaseReason },
    today: todayCheck(planned, inp.coach, thisWeek.plan),
    projection,
    notes,
    intensity: intensityCheck(inp),
    ftpTest: ftpTestPlan(inp, thisWeek.plan, tests.at(-1)?.day ?? null, next),
    makeUp: makeUpPlan(thisWeek.comparison, inp.today, inp.coach?.readiness ?? null, next.days[0] ?? null),
    strengthDeload: strengthDeload(sessions, inp.today),
    block: { ...blockView(savedBlock ?? proposeBlock(inp), inp.weeks, inp.today, blockWarning(inp)), saved: Boolean(savedBlock) },
    strengthWorkouts: {
      days: thisWeek.plan.days.filter((d) => d.day >= inp.today && d.strength).map((d) => strengthWorkout(d.day, d.strength!, sessions)),
      note: STRENGTH_PLAN_NOTE,
    },
    fueling: { days: thisWeek.plan.days.map((d) => fuelingFor(d, inp.body?.weightKg ?? null)).filter((f): f is Fueling => f !== null), note: FUELING_NOTE },
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

export interface IntensityCheck {
  /** Ausdauer-Einheiten (Rad/Spinning ab 20 min) der letzten 28 Tage mit Puls. */
  rides: number;
  avgHr: number;
  /** Geplanter Grundlagenbereich (80–89 % der Schwelle). */
  zone2: { min: number; max: number };
  below: number;
  inRange: number;
  above: number;
  verdict: "below" | "ok" | "above";
  text: string;
}

const ENDURANCE_SPORTS = ["cycl", "spin", "bike", "rad", "ride", "run", "lauf"];

/**
 * Vergleicht den Durchschnittspuls der Ausdauer-Einheiten mit dem Grundlagenbereich des Plans.
 * Erklärt z. B., warum die gemessene Belastung unter dem Soll bleibt. Schätzung (Schwelle ggf. Standardwert).
 */
export function intensityCheck(inp: TrainingInputs): IntensityCheck | null {
  const thr = inp.settings.thresholdHr;
  if (!thr) return null;
  const from = addDays(inp.today, -27);
  const rides = inp.workouts.filter(
    (w) => w.day >= from && w.day <= inp.today && w.durationMin >= 20 && w.avgHr != null && !!w.sport && ENDURANCE_SPORTS.some((k) => w.sport!.toLowerCase().includes(k)),
  );
  if (rides.length < 3) return null;
  const zone2 = { min: Math.round(thr * 0.8), max: Math.round(thr * 0.89) };
  // Grundlage ist oft etwas unter Zone 2 (Zone 1 als lockere Einheit) – erst ~10 Schläge darunter zählt als „deutlich darunter“.
  const below = rides.filter((w) => w.avgHr! < zone2.min - 10).length;
  const above = rides.filter((w) => w.avgHr! > zone2.max).length;
  const inRange = rides.length - below - above;
  const min = rides.reduce((a, w) => a + w.durationMin, 0);
  const avgHr = Math.round(rides.reduce((a, w) => a + w.avgHr! * w.durationMin, 0) / min);
  const est = inp.settings.origin?.thresholdHr === "default" ? " Die Schwelle ist geschätzt; trag deine echte Schwelle ein (z. B. aus einem 30-min-Test), dann passt der Bereich genauer." : "";
  let verdict: IntensityCheck["verdict"] = "ok";
  let text = `Deine Ausdauer-Einheiten liegen meist im geplanten Bereich (Schnitt ${avgHr} S/min).`;
  if (below / rides.length >= 0.6) {
    verdict = "below";
    text = `Deine Ausdauer-Einheiten der letzten 4 Wochen liegen im Schnitt bei ${avgHr} S/min, der Plan rechnet Grundlage mit ${zone2.min}–${zone2.max}. Darum bleibt die gemessene Belastung unter dem Soll. Für mehr Fitnesszuwachs die Grundlagen-Einheiten etwas zügiger fahren; sehr locker ist nur an Erholungstagen gedacht.${est}`;
  } else if (above / rides.length >= 0.5) {
    verdict = "above";
    text = `Deine Ausdauer-Einheiten liegen oft über dem Grundlagenbereich (Schnitt ${avgHr} S/min, Plan ${zone2.min}–${zone2.max}). Grundlage ruhiger fahren, damit harte Tage wirklich hart sein können.${est}`;
  }
  return { rides: rides.length, avgHr, zone2, below, inRange, above, verdict, text };
}

export interface FtpTestPlan {
  due: boolean;
  /** Ausgeruht genug für einen Test (Form ≥ 0)? */
  rested: boolean;
  reason: string;
  /** Vorgeschlagener Testtag ab heute (diese Woche, sonst nächste) und welche Einheit er ersetzt. */
  day: string | null;
  replaces: string | null;
  text: string;
  howTo: string[];
}

/**
 * FTP-Test einplanen: fällig ohne Test oder nach ≥ 6 Wochen (ftp-test.ts). Der Testtag ersetzt eine
 * Tempo-/Schwellen-/VO2max- oder Grundlageneinheit ab heute, die nicht direkt nach der langen Fahrt,
 * einer harten Einheit oder Beinkraft liegt. Die Form wird am Tag selbst geprüft (Tagesempfehlung).
 */
export function ftpTestPlan(inp: TrainingInputs, plan: WeekPlan, lastTestDay: string | null, nextPlan?: WeekPlan): FtpTestPlan | null {
  const t = inp.days.find((d) => d.day === inp.today) ?? inp.days.at(-1);
  const s = ftpTestSuggestion(t?.tsb ?? null, lastTestDay, inp.today);
  const due = s.daysSinceLastTest == null || s.daysSinceLastTest >= 42;
  if (!due) return null;
  const pickIn = (p: WeekPlan) => {
    const ok = (i: number) => {
      const d = p.days[i];
      if (d.day < inp.today || !["tempo", "threshold", "vo2max", "endurance"].includes(d.type)) return false;
      const prev = p.days[i - 1];
      if (prev && (prev.type === "long" || prev.type === "race" || isHard(prev.type) || (prev.strength && !/^Oberkörper/.test(prev.strength.focus)))) return false;
      return true;
    };
    const order = p.days.map((_, i) => i).filter(ok).sort((a, b) => Number(isHard(p.days[b].type)) - Number(isHard(p.days[a].type)) || a - b);
    return order.length ? p.days[order[0]] : null;
  };
  const pick = pickIn(plan);
  const later = pick || !nextPlan ? null : pickIn(nextPlan);
  const noFtp = inp.settings.ftpW == null ? " Ohne FTP rechnet der Plan nur mit Puls; mit einem Test bekommst du Wattbereiche für die Rolle." : "";
  const how = "(Ramp-Test in MyWhoosh, ca. 30–45 min mit Ein- und Ausfahren). Nur testen, wenn du dich an dem Tag frisch fühlst.";
  const text = pick
    ? `FTP-Test einplanen: ${weekdayName(pick.day)} statt „${pick.title}“ ${how}${noFtp}`
    : later
      ? `FTP-Test ist fällig; diese Woche passt kein Tag mehr. Vorschlag: nächste Woche ${weekdayName(later.day)} statt „${later.title}“ ${how}${noFtp}`
      : `FTP-Test ist fällig; diese Woche passt kein Tag mehr gut. Nächste Woche an einem frischen Tag statt einer Tempo- oder Schwelleneinheit testen.${noFtp}`;
  const chosen = pick ?? later;
  return { due, rested: s.tsb != null && s.tsb >= 0, reason: s.reason, day: chosen?.day ?? null, replaces: chosen?.title ?? null, text, howTo: s.howTo };
}
