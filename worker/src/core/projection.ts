// Formprognose bis zum Ziel-Termin: Fitness (CTL), Ermüdung (ATL) und Form (TSB) werden mit den
// geplanten Wochenbelastungen fortgeschrieben (dieselbe Formel wie trainingLoad in analysis.ts).
// Schätzung: setzt voraus, dass der Plan so trainiert wird; echte Tage ersetzen die Prognose.
import { addDays, daysBetween, weekStart, type WeekSummary } from "./analysis";
import { PHASE_LABEL, buildWeekPlan, nextEvent, type Goal, type Phase, type TrainingPrefs, type WeekPlan } from "./plan";

export interface ProjectionPoint {
  day: string;
  load: number;
  ctl: number;
  atl: number;
  tsb: number;
}

export interface ProjectedWeek {
  week: string;
  phase: Phase;
  phaseLabel: string;
  targetLoad: number;
  targetHours: number;
  /** Fitness am Wochenende (Prognose). */
  ctlEnd: number;
}

export type FormZone = "overreaching" | "productive" | "maintaining" | "fresh" | "detraining";

export interface EventProjection {
  goal: Goal;
  daysLeft: number;
  weeks: ProjectedWeek[];
  days: ProjectionPoint[];
  atEvent: { ctl: number; atl: number; tsb: number; formZone: FormZone; ctlGain: number };
  /** Wunschbereich für die Form am Wettkampftag. */
  targetTsb: { min: number; max: number };
  verdict: "on_track" | "too_tired" | "too_fresh" | "short";
  advice: string[];
  disclaimer: string;
}

export const formZone = (tsb: number): FormZone => (tsb < -30 ? "overreaching" : tsb < -10 ? "productive" : tsb < 5 ? "maintaining" : tsb <= 25 ? "fresh" : "detraining");

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Höchstens so viele Wochen in die Zukunft (danach wird die Prognose zu unsicher). */
export const MAX_PROJECTION_WEEKS = 26;

export interface ProjectionInput {
  today: string;
  /** Stand am Ende von gestern. */
  ctl: number;
  atl: number;
  goals: Goal[];
  prefs: TrainingPrefs;
  weeks: WeekSummary[];
  /** Plan der laufenden Woche (gespeichert oder Vorschlag); seine restlichen Tage gehen ein. */
  currentPlan: WeekPlan | null;
  /** Belastung, die heute schon trainiert wurde. */
  todayLoad: number;
  ftpW: number | null;
  thresholdHr: number | null;
  maxHr: number | null;
  goalId?: number;
}

export function projectEvent(inp: ProjectionInput): EventProjection | null {
  const goal = inp.goalId != null ? inp.goals.find((g) => g.id === inp.goalId && g.targetDate) ?? null : nextEvent(inp.goals, inp.today);
  if (!goal?.targetDate || goal.targetDate < inp.today) return null;
  const daysLeft = daysBetween(inp.today, goal.targetDate);
  const lastDay = goal.targetDate;
  const horizon = addDays(weekStart(inp.today), MAX_PROJECTION_WEEKS * 7 - 1);
  const end = lastDay < horizon ? lastDay : horizon;

  // Rest der laufenden Woche aus dem Plan; heute zählt das Größere aus Plan und schon Trainiertem.
  const loads = new Map<string, number>();
  for (const d of inp.currentPlan?.days ?? []) {
    if (d.day < inp.today) continue;
    loads.set(d.day, d.day === inp.today ? Math.max(inp.todayLoad, d.targetLoad) : d.targetLoad);
  }
  loads.set(inp.today, Math.max(inp.todayLoad, loads.get(inp.today) ?? 0));

  const weeks: ProjectedWeek[] = [];
  const pastWeeks = [...inp.weeks];
  let ctl = inp.ctl, atl = inp.atl;
  const days: ProjectionPoint[] = [];
  const step = (day: string) => {
    const load = loads.get(day) ?? 0;
    const tsb = ctl - atl;
    ctl += (load - ctl) / 42;
    atl += (load - atl) / 7;
    days.push({ day, load: Math.round(load), ctl: r1(ctl), atl: r1(atl), tsb: r1(tsb) });
  };

  let day = inp.today;
  const curWeekEnd = addDays(weekStart(inp.today), 6);
  if (inp.currentPlan) {
    weeks.push({
      week: inp.currentPlan.weekStart, phase: inp.currentPlan.phase, phaseLabel: PHASE_LABEL[inp.currentPlan.phase],
      targetLoad: inp.currentPlan.targetLoad, targetHours: inp.currentPlan.targetHours, ctlEnd: 0,
    });
  }
  for (; day <= end && day <= curWeekEnd; day = addDays(day, 1)) step(day);
  if (weeks.length) weeks[0].ctlEnd = days.at(-1)?.ctl ?? r1(ctl);

  // Folgewochen: Regelplan mit fortgeschriebener Fitness und Form.
  for (let ws = addDays(weekStart(inp.today), 7); ws <= end; ws = addDays(ws, 7)) {
    const ctlStart = ctl;
    const plan = buildWeekPlan({
      weekStart: ws, goals: inp.goals, prefs: inp.prefs, weeks: pastWeeks, ctl: r1(ctl), tsb: r1(ctl - atl),
      ftpW: inp.ftpW, thresholdHr: inp.thresholdHr, maxHr: inp.maxHr,
    });
    for (const d of plan.days) loads.set(d.day, d.targetLoad);
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (d > end) break;
      step(d);
    }
    weeks.push({ week: ws, phase: plan.phase, phaseLabel: PHASE_LABEL[plan.phase], targetLoad: plan.targetLoad, targetHours: plan.targetHours, ctlEnd: r1(ctl) });
    pastWeeks.push({
      week: ws, workouts: 0, trainingH: plan.targetHours, load: plan.targetLoad, distanceKm: 0, bySport: {}, avgRecovery: null, avgHrv: null,
      avgRhr: null, avgSleepH: null, avgStrain: null, sleepDebtH: null, ctlEnd: r1(ctl), ctlChange: r1(ctl - ctlStart),
    });
  }

  // Form am Wettkampfmorgen = Stand vor der Belastung des Tages.
  const eventPoint = days.find((p) => p.day === goal.targetDate) ?? days.at(-1) ?? { day: inp.today, load: 0, ctl: r1(inp.ctl), atl: r1(inp.atl), tsb: r1(inp.ctl - inp.atl) };
  const before = days.find((p) => p.day === addDays(goal.targetDate!, -1));
  const atEvent = {
    ctl: before?.ctl ?? eventPoint.ctl,
    atl: before?.atl ?? eventPoint.atl,
    tsb: eventPoint.tsb,
    formZone: formZone(eventPoint.tsb),
    ctlGain: r1((before?.ctl ?? eventPoint.ctl) - inp.ctl),
  };
  // Für A-Rennen gilt Form +5 … +25 als guter Bereich (Faustregel), für B/C-Termine reicht etwa 0.
  const targetTsb = goal.priority === "A" ? { min: 5, max: 25 } : { min: -5, max: 20 };
  const advice: string[] = [];
  let verdict: EventProjection["verdict"] = "on_track";
  if (lastDay > horizon) {
    verdict = "on_track";
    advice.push(`Der Termin liegt mehr als ${MAX_PROJECTION_WEEKS} Wochen entfernt; die Prognose reicht bis ${horizon}.`);
  } else if (daysLeft < 7) {
    verdict = "short";
    advice.push("Weniger als eine Woche: Fitness lässt sich jetzt nicht mehr steigern, nur noch frisch werden. Locker bleiben, 1–2 kurze Aktivierungen.");
  } else if (atEvent.tsb < targetTsb.min) {
    verdict = "too_tired";
    advice.push(`Am Termin vermutlich noch müde (Form ${atEvent.tsb}). Tapering früher beginnen oder die letzte Aufbauwoche leichter machen.`);
  } else if (atEvent.tsb > targetTsb.max) {
    verdict = "too_fresh";
    advice.push(`Am Termin vermutlich sehr ausgeruht (Form +${atEvent.tsb}), Fitness geht dabei schon zurück. Tapering kürzer halten.`);
  } else {
    advice.push(`Form am Termin voraussichtlich ${atEvent.tsb >= 0 ? "+" : ""}${atEvent.tsb} – im guten Bereich.`);
  }
  if (daysLeft >= 21 && atEvent.ctlGain < 2) advice.push("Fitness steigt bis zum Termin kaum. Mehr Trainingszeit oder Intensität würde helfen, sofern die Erholung mitspielt.");
  if (atEvent.ctlGain > 0) advice.push(`Fitness bis dahin etwa +${atEvent.ctlGain} Punkte (von ${r1(inp.ctl)} auf ${atEvent.ctl}).`);

  return {
    goal,
    daysLeft,
    weeks,
    days,
    atEvent,
    targetTsb,
    verdict,
    advice,
    disclaimer: "Prognose unter der Annahme, dass der Plan so trainiert wird. Belastung, Fitness und Form sind Schätzungen.",
  };
}
