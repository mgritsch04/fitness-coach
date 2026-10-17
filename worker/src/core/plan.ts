// Wochenplanung mit einfacher Periodisierung (Grundlage → Aufbau → Spitze → Tapering) und
// Soll/Ist-Abgleich. Reine Funktionen ohne D1. Trainingsempfehlungen, keine medizinische Diagnose;
// Belastungswerte (TSS-Maßstab) und Phasen sind Schätzungen nach gängigen Faustregeln.
import { addDays, daysBetween, weekStart, type WeekSummary } from "./analysis";
import { strengthSeason, type StrengthSeasonPhase } from "./strength-season";

export type GoalKind = "event" | "fitness" | "weight" | "habit" | "other";
export type GoalPriority = "A" | "B" | "C";
export type GoalStatus = "active" | "done" | "dropped";

export interface Goal {
  id: number;
  kind: GoalKind;
  title: string;
  targetDate: string | null;
  /** z. B. ftpW, ctl, weightKg, weeklyHours */
  metric: string | null;
  targetValue: number | null;
  unit: string | null;
  sport: string | null;
  priority: GoalPriority;
  status: GoalStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Wochentage 0 = Montag … 6 = Sonntag. */
export interface TrainingPrefs {
  /** Verfügbare Trainingszeit pro Woche in Stunden. */
  weeklyHours: number | null;
  /** Feste Ruhetage. */
  restDays: number[];
  /** Tag für die lange Einheit. */
  longDay: number | null;
  /** Längste mögliche Einheit unter der Woche (Minuten). */
  maxWeekdayMin: number | null;
  /** Hauptsportart für die Beschreibungen (cycling, running, …). */
  mainSport: string | null;
  /** Krafteinheiten pro Woche (0–6); null = aus den letzten Wochen geschätzt. */
  strengthPerWeek: number | null;
  /** Dauer einer Krafteinheit (min); null = aus den letzten Wochen geschätzt. */
  strengthMin: number | null;
  /** Saisonphase fürs Krafttraining (#213); null = automatisch aus Planphase und Jahreszeit. */
  strengthPhase?: StrengthSeasonPhase | null;
  /** Radeinheiten pro Woche als Ziel für die Serien (#209); null = aus den letzten Wochen geschätzt. */
  ridesPerWeek?: number | null;
}

// Standard für G: Rennrad (derzeit indoor mit MyWhoosh) plus Kraft im Gym; Häufigkeit und Dauer
// der Krafteinheiten werden aus den letzten Wochen übernommen, solange nichts eingetragen ist.
export const DEFAULT_PREFS: TrainingPrefs = { weeklyHours: null, restDays: [], longDay: null, maxWeekdayMin: null, mainSport: "cycling", strengthPerWeek: null, strengthMin: null, strengthPhase: null, ridesPerWeek: null };

export type Phase = "base" | "build" | "peak" | "taper" | "race" | "recovery" | "maintain";
export type SessionType = "rest" | "recovery" | "endurance" | "long" | "tempo" | "threshold" | "vo2max" | "strength" | "opener" | "race";

export interface PlannedSession {
  day: string;
  type: SessionType;
  title: string;
  durationMin: number;
  /** Geschätzte Belastung im TSS-Maßstab. */
  targetLoad: number;
  /** Zone bzw. Intensität in Worten. */
  intensity: string;
  description: string;
  /** Schlüsseleinheit der Woche (nicht ausfallen lassen, notfalls verschieben). */
  key: boolean;
  /** Krafteinheit am selben Tag (zusätzlich zur Ausdauer oder allein bei type = strength). */
  strength: { durationMin: number; focus: string } | null;
}

export interface WeekPlan {
  weekStart: string;
  phase: Phase;
  phaseReason: string;
  /** Ziel, auf das die Woche hinarbeitet. */
  goalId: number | null;
  targetLoad: number;
  targetHours: number;
  days: PlannedSession[];
  notes: string[];
  source: "rule" | "coach";
}

export const PHASE_LABEL: Record<Phase, string> = {
  base: "Grundlage",
  build: "Aufbau",
  peak: "Spitze",
  taper: "Tapering",
  race: "Wettkampfwoche",
  recovery: "Erholungswoche",
  maintain: "Erhalten",
};

/** Belastung je Stunde (TSS/h) – grobe Richtwerte. */
const TSS_PER_H: Record<SessionType, number> = {
  rest: 0, recovery: 30, endurance: 50, long: 55, tempo: 70, threshold: 80, vo2max: 85, strength: 35, opener: 60, race: 90,
};

/** Wochenbelastung relativ zur aktuellen Fitness (CTL · 7). */
const LOAD_FACTOR: Record<Phase, number> = { base: 1.05, build: 1.1, peak: 1.0, taper: 0.6, race: 0.55, recovery: 0.6, maintain: 1.0 };

const HARD: SessionType[] = ["tempo", "threshold", "vo2max", "race", "opener"];
export const isHard = (t: SessionType) => HARD.includes(t);

// --- Phase ---------------------------------------------------------------------------------

/** Nächstes aktives Terminziel ab `from` (A vor B vor C, dann das früheste). */
export function nextEvent(goals: Goal[], from: string): Goal | null {
  const events = goals.filter((g) => g.status === "active" && g.kind === "event" && g.targetDate && g.targetDate >= from);
  const order = { A: 0, B: 1, C: 2 };
  events.sort((a, b) => order[a.priority] - order[b.priority] || a.targetDate!.localeCompare(b.targetDate!));
  // Ein B/C-Termin vor dem A-Ziel zählt nur, wenn kein A-Ziel existiert.
  return events[0] ?? null;
}

/**
 * Phase der Woche. Mit Terminziel rückwärts gerechnet: Wettkampfwoche, 1 Woche Tapering,
 * 2–3 Wochen Spitze, 4–11 Wochen Aufbau, davor Grundlage. Nach drei Aufbauwochen in Folge
 * oder sehr niedriger Form eine Erholungswoche (3:1-Rhythmus).
 */
export function choosePhase(week: string, goals: Goal[], pastWeeks: WeekSummary[], tsbNow: number | null): { phase: Phase; reason: string; goal: Goal | null } {
  const goal = nextEvent(goals, week);
  const done = pastWeeks.filter((w) => w.week < week).sort((a, b) => a.week.localeCompare(b.week));
  const last3 = done.slice(-3);
  const building = last3.length === 3 && last3.every((w) => w.ctlChange > 0.5);
  const fatigued = tsbNow != null && tsbNow < -25;

  if (goal) {
    const weeksTo = Math.floor(daysBetween(week, goal.targetDate!) / 7);
    if (weeksTo <= 0) return { phase: "race", reason: `Termin „${goal.title}“ ist diese Woche.`, goal };
    if (weeksTo === 1) return { phase: "taper", reason: `Noch 1 Woche bis „${goal.title}“: Umfang runter, Spritzigkeit halten.`, goal };
    if (fatigued) return { phase: "recovery", reason: "Form sehr niedrig (hohe Ermüdung): erst erholen.", goal };
    if (weeksTo <= 3) return { phase: "peak", reason: `Noch ${weeksTo} Wochen bis „${goal.title}“: wettkampfnahe Intensität.`, goal };
    if (building) return { phase: "recovery", reason: "Drei Aufbauwochen in Folge: Erholungswoche, damit die Fitness ankommt.", goal };
    if (weeksTo <= 11) return { phase: "build", reason: `Noch ${weeksTo} Wochen bis „${goal.title}“: gezielter Aufbau.`, goal };
    return { phase: "base", reason: `Noch ${weeksTo} Wochen bis „${goal.title}“: Grundlage legen.`, goal };
  }
  if (fatigued) return { phase: "recovery", reason: "Form sehr niedrig (hohe Ermüdung): erst erholen.", goal: null };
  if (building) return { phase: "recovery", reason: "Drei Aufbauwochen in Folge: Erholungswoche, damit die Fitness ankommt.", goal: null };
  const fitnessGoal = goals.some((g) => g.status === "active" && g.kind === "fitness");
  return fitnessGoal
    ? { phase: "base", reason: "Kein Termin, aber ein Fitnessziel: Grundlage mit etwas Tempo.", goal: null }
    : { phase: "maintain", reason: "Kein Termin eingetragen: Fitness halten. Trage ein Ziel ein, dann plane ich gezielt darauf hin.", goal: null };
}

// --- Plan ----------------------------------------------------------------------------------

export interface PlanInput {
  weekStart: string;
  goals: Goal[];
  prefs: TrainingPrefs;
  /** Abgeschlossene und laufende Wochen (für Phase und Stundenschätzung). */
  weeks: WeekSummary[];
  /** Fitness (CTL) und Form (TSB) zu Wochenbeginn bzw. heute. */
  ctl: number;
  tsb: number | null;
  ftpW: number | null;
  thresholdHr: number | null;
  maxHr: number | null;
  /** Wochenziel aus einem gespeicherten 4-Wochen-Block (#206); Termin-Phasen (Spitze, Tapering, Wettkampf) haben Vorrang. */
  block?: { targetLoad: number; deload: boolean; label: string } | null;
}

const WEEKDAY = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

/** Sessions je Phase: harte Schlüsseleinheiten in Reihenfolge der Wichtigkeit. */
const KEYS: Record<Phase, SessionType[]> = {
  base: ["tempo"],
  build: ["threshold", "vo2max"],
  peak: ["vo2max", "threshold"],
  taper: ["opener"],
  race: ["opener"],
  recovery: [],
  maintain: ["tempo"],
};

const sportWord = (s: string | null) => {
  const k = (s ?? "cycling").toLowerCase();
  if (k.includes("run") || k.includes("lauf")) return { noun: "Lauf", verb: "laufen", power: false };
  if (k.includes("swim") || k.includes("schwimm")) return { noun: "Schwimmen", verb: "schwimmen", power: false };
  return { noun: "Fahrt", verb: "fahren", power: true };
};

/** WHOOP-Zone (0–5, Anteile der maximalen Herzfrequenz) eines Pulswerts – dieselben Zonen wie im Dashboard. */
export const whoopZone = (bpm: number, maxHr: number) => Math.max(0, Math.min(5, Math.floor((bpm / maxHr) * 10 + 1e-9) - 4));

/** Plan-Zonen beziehen sich auf die Schwelle; dazu die passende WHOOP-Zone, damit die Zahlen zum Dashboard passen. */
export function whoopZoneText(lo: number, hi: number, maxHr: number): string {
  const a = whoopZone(lo, maxHr), b = whoopZone(Math.max(lo, hi - 1), maxHr);
  return a === b ? `WHOOP-Zone ${a}` : `WHOOP-Zone ${a}–${b}`;
}

function intensityText(type: SessionType, inp: Pick<PlanInput, "ftpW" | "thresholdHr" | "maxHr">, power: boolean): string {
  const w = (lo: number, hi: number) => (power && inp.ftpW ? ` (${Math.round(inp.ftpW * lo)}–${Math.round(inp.ftpW * hi)} W)` : "");
  const hr = (lo: number, hi: number) => {
    if (!inp.thresholdHr) return "";
    const a = Math.round(inp.thresholdHr * lo), b = Math.round(inp.thresholdHr * hi);
    return ` (Puls ${a}–${b}${inp.maxHr ? `, ${whoopZoneText(a, b, inp.maxHr)}` : ""})`;
  };
  switch (type) {
    case "recovery": return `Zone 1, sehr locker${w(0.4, 0.55)}${hr(0.68, 0.8)}`;
    case "endurance": return `Zone 2, Grundlage${w(0.56, 0.75)}${hr(0.8, 0.89)}`;
    case "long": return `Zone 2, gleichmäßig${w(0.56, 0.75)}${hr(0.8, 0.89)}`;
    case "tempo": return `Zone 3, zügig${w(0.76, 0.9)}${hr(0.9, 0.94)}`;
    case "threshold": return `Zone 4, Schwelle${w(0.91, 1.05)}${hr(0.95, 1.0)}`;
    case "vo2max": return `Zone 5, hart${w(1.06, 1.2)}${hr(1.0, 1.06)}`;
    case "opener": return `kurz Zone 4–5, sonst locker${w(1.0, 1.15)}`;
    case "race": return "Wettkampf";
    case "strength": return "Kraft, Ganzkörper";
    default: return "frei";
  }
}

function describe(type: SessionType, min: number, noun: string): { title: string; description: string } {
  switch (type) {
    case "rest": return { title: "Ruhetag", description: "Frei, Spaziergang oder Mobility. Erholung ist Teil des Trainings." };
    case "recovery": return { title: `Lockere ${noun}`, description: `${min} min ganz locker zum Durchbewegen.` };
    case "endurance": return { title: `Grundlagen-${noun}`, description: `${min} min gleichmäßig in Zone 2, ruhig atmen, sprechen möglich${noun === "Fahrt" ? " (Rolle/MyWhoosh im ERG-Modus oder draußen)" : ""}.` };
    case "long": return { title: `Lange ${noun}`, description: `${min} min Zone 2, unterwegs essen und trinken. Wichtigste Ausdauereinheit der Woche.` };
    case "tempo": return { title: "Tempo", description: `${min} min mit 2–3 × 12–15 min Zone 3, dazwischen 5 min locker.` };
    case "threshold": return { title: "Schwelle", description: `${min} min mit 3 × 10 min (oder 2 × 15 min) an der Schwelle, 5 min Pause dazwischen.` };
    case "vo2max": return { title: "VO₂max-Intervalle", description: `${min} min mit 5 × 4 min hart, 4 min locker dazwischen. Gut einfahren.` };
    case "opener": return { title: "Aktivierung", description: `${min} min locker mit 3 × 1 min zügig, damit die Beine wach bleiben.` };
    case "race": return { title: "Wettkampf", description: "Viel Erfolg! Gut einfahren, gleichmäßig einteilen." };
    case "strength": return { title: "Krafttraining", description: `${min} min Ganzkörper (Kniebeuge, Kreuzheben, Rumpf), 2–3 Sätze.` };
  }
}

const strengthMinutes = (w: WeekSummary) => Object.entries(w.bySport).filter(([k]) => isStrengthSport(k)).reduce((a, [, v]) => a + v.minutes, 0);
const strengthCount = (w: WeekSummary) => Object.entries(w.bySport).filter(([k]) => isStrengthSport(k)).reduce((a, [, v]) => a + v.count, 0);

/** Ausdauer-Stunden der Woche (ohne Kraft): Vorgabe des Nutzers, sonst Schnitt der letzten Wochen (Schätzung). */
export function weeklyHoursFor(prefs: TrainingPrefs, weeks: WeekSummary[], week: string): { hours: number; estimated: boolean } {
  if (prefs.weeklyHours) return { hours: prefs.weeklyHours, estimated: false };
  const recent = weeks.filter((w) => w.week < week).slice(-4).map((w) => w.trainingH - strengthMinutes(w) / 60).filter((h) => h > 0);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 4;
  return { hours: Math.min(12, Math.max(3, Math.round(avg * 2) / 2)), estimated: true };
}

/** Kraft-Gewohnheit: Vorgabe oder Schnitt der letzten 4 abgeschlossenen Wochen (Standard 2 × 45 min). */
export function strengthHabit(prefs: TrainingPrefs, weeks: WeekSummary[], week: string): { perWeek: number; minutes: number; estimated: boolean } {
  const recent = weeks.filter((w) => w.week < week).slice(-4);
  const count = recent.reduce((a, w) => a + strengthCount(w), 0);
  const mins = recent.reduce((a, w) => a + strengthMinutes(w), 0);
  const perWeek = prefs.strengthPerWeek ?? (recent.length ? Math.min(6, Math.round(count / recent.length)) : 2);
  const minutes = prefs.strengthMin ?? (count ? Math.min(90, Math.max(20, Math.round(mins / count / 5) * 5)) : 45);
  return { perWeek: Math.max(0, Math.min(6, perWeek)), minutes, estimated: prefs.strengthPerWeek == null };
}

export function buildWeekPlan(inp: PlanInput): WeekPlan {
  const week = weekStart(inp.weekStart);
  const picked = choosePhase(week, inp.goals, inp.weeks, inp.tsb);
  const { goal } = picked;
  let { phase, reason } = picked;
  const useBlock = inp.block && !["peak", "taper", "race"].includes(phase) ? inp.block : null;
  if (useBlock?.deload) {
    phase = "recovery";
    reason = `${useBlock.label}: Entlastungswoche im Block, damit die Fitness ankommt.`;
  } else if (useBlock && phase !== "recovery") reason = `${useBlock.label}. ${reason}`;
  const notes: string[] = [];
  const sport = sportWord(inp.prefs.mainSport ?? goal?.sport ?? null);

  const hoursInfo = weeklyHoursFor(inp.prefs, inp.weeks, week);
  if (hoursInfo.estimated) notes.push(`Trainingszeit auf ${hoursInfo.hours} h geschätzt (Schnitt der letzten Wochen). Trage deine verfügbare Zeit ein, dann passt der Plan genauer.`);
  // Ohne Lastdaten (CTL < 15) richtet sich die Belastung nach der Zeit.
  const hasLoad = inp.ctl >= 15;
  const phaseHours = { taper: 0.6, race: 0.5, recovery: 0.6 } as Partial<Record<Phase, number>>;
  let hours = hoursInfo.hours * (phaseHours[phase] ?? 1);
  let targetLoad = hasLoad ? Math.round(inp.ctl * 7 * LOAD_FACTOR[phase]) : Math.round(hours * 50);
  // Blockziel ersetzt die Faustregel, außer die Phase verlangt Erholung (dann gilt der niedrigere Wert).
  if (useBlock && hasLoad) targetLoad = phase === "recovery" ? Math.min(targetLoad, useBlock.targetLoad) : useBlock.targetLoad;
  if (hasLoad) {
    // Nicht mehr Stunden einplanen, als die Zielbelastung bei lockerem Schnitt (~52 TSS/h) braucht.
    hours = Math.min(hours, Math.max(2, targetLoad / 45));
  } else {
    notes.push("Noch wenig Belastungsdaten: Plan richtet sich nach der Zeit, Belastung ist grob geschätzt.");
  }
  hours = Math.round(hours * 4) / 4;

  // Trainingstage auswählen.
  const rest = new Set(inp.prefs.restDays.filter((d) => d >= 0 && d <= 6));
  const available = [0, 1, 2, 3, 4, 5, 6].filter((d) => !rest.has(d));
  const wanted = hours <= 3 ? 3 : hours <= 5 ? 4 : hours <= 8 ? 5 : 6;
  const nTrain = Math.min(available.length, Math.max(phase === "race" ? 3 : 2, wanted));
  let longDay = inp.prefs.longDay != null && available.includes(inp.prefs.longDay) ? inp.prefs.longDay : [5, 6, 4, 3].find((d) => available.includes(d)) ?? available.at(-1)!;

  const raceDay = phase === "race" && goal?.targetDate ? (new Date(goal.targetDate + "T00:00:00Z").getUTCDay() + 6) % 7 : null;
  if (raceDay != null) longDay = raceDay;

  // Tage gleichmäßig verteilen, Langtag immer dabei; in der Wettkampfwoche auch der Vortag (Aktivierung).
  const chosen = new Set<number>([longDay]);
  if (raceDay != null && raceDay > 0 && available.includes(raceDay - 1)) chosen.add(raceDay - 1);
  const others = available.filter((d) => !chosen.has(d));
  while (chosen.size < nTrain && others.length) {
    // Tag mit größtem Abstand zu den schon gewählten (zyklisch über die Woche).
    let best = others[0], bestGap = -1;
    for (const d of others) {
      const gap = Math.min(...[...chosen].map((c) => Math.min(Math.abs(c - d), 7 - Math.abs(c - d))));
      if (gap > bestGap) (best = d), (bestGap = gap);
    }
    chosen.add(best);
    others.splice(others.indexOf(best), 1);
  }

  const types = new Map<number, SessionType>();
  for (const d of chosen) types.set(d, "endurance");
  if (raceDay != null) types.set(raceDay, "race");
  else types.set(longDay, phase === "taper" ? "endurance" : "long");

  // Schlüsseleinheiten: nie an Nachbartagen von harten Tagen oder dem Langtag.
  const keys = [...KEYS[phase]];
  const keyCount = phase === "base" || phase === "maintain" ? (nTrain >= 4 ? 1 : 0) : Math.min(keys.length, nTrain >= 4 ? keys.length : 1);
  const isBlocked = (d: number) => [d - 1, d + 1].some((n) => n >= 0 && n <= 6 && types.has(n) && (isHard(types.get(n)!) || types.get(n) === "long"));
  for (const k of keys.slice(0, keyCount)) {
    let candidates = [...chosen].filter((d) => types.get(d) === "endurance" && !isBlocked(d));
    if (k === "opener" && raceDay != null) {
      // Aktivierung 1–2 Tage vor dem Wettkampf.
      const pre = [raceDay - 1, raceDay - 2].filter((d) => d >= 0 && chosen.has(d));
      candidates = pre.length ? pre : candidates;
    }
    if (!candidates.length) candidates = [...chosen].filter((d) => types.get(d) === "endurance");
    if (!candidates.length) break;
    // Möglichst weit weg vom Langtag; im Tapering die kurze Intensität zur Wochenmitte.
    if (phase === "taper") candidates.sort((a, b) => Math.abs(a - 2) - Math.abs(b - 2));
    else candidates.sort((a, b) => Math.abs(b - longDay) - Math.abs(a - longDay));
    types.set(candidates[0], k);
  }
  // Tag nach dem Langtag/harter Einheit: eher Erholung.
  for (const d of chosen) {
    const prev = types.get(d - 1);
    if (types.get(d) === "endurance" && prev && (prev === "long" || prev === "race" || prev === "vo2max")) types.set(d, "recovery");
  }
  if (phase === "recovery") for (const d of chosen) if (types.get(d) === "endurance" && d % 2 === 1) types.set(d, "recovery");

  // Dauer verteilen.
  const totalMin = Math.round(hours * 60);
  const share: Partial<Record<SessionType, number>> = { long: 2.2, race: 1.5, threshold: 1.2, vo2max: 1.1, tempo: 1.2, endurance: 1, recovery: 0.6, opener: 0.7 };
  const trainDays = [...chosen];
  const weights = trainDays.map((d) => share[types.get(d)!] ?? 1);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const maxWeekday = inp.prefs.maxWeekdayMin ?? null;
  const minutes = new Map<number, number>();
  trainDays.forEach((d, i) => {
    let m = Math.round(((totalMin * weights[i]) / wSum) / 5) * 5;
    const t = types.get(d)!;
    if (t === "recovery") m = Math.min(m, 60);
    if (t === "opener") m = Math.min(m, 60);
    if (maxWeekday && d < 5 && t !== "race") m = Math.min(m, maxWeekday);
    minutes.set(d, Math.max(t === "recovery" || t === "opener" ? 30 : 40, m));
  });

  // Kraft: nicht in der Wettkampfwoche, im Tapering und in Erholungswochen höchstens eine leichte.
  const habit = strengthHabit(inp.prefs, inp.weeks, week);
  // Saisonphase (#213): ohne feste Vorgabe begrenzt Erhalt auf 2, Wettkampf auf 1 Einheit.
  const season = strengthSeason(phase, week, inp.prefs.strengthPhase ?? null);
  if (habit.estimated && season.maxPerWeek != null) habit.perWeek = Math.min(habit.perWeek, season.maxPerWeek);
  const strengthWanted = phase === "race" ? 0 : phase === "taper" ? Math.min(1, habit.perWeek) : phase === "recovery" ? Math.min(3, Math.ceil(habit.perWeek / 2)) : habit.perWeek;
  const days: PlannedSession[] = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays(week, d);
    const t: SessionType = types.get(d) ?? "rest";
    const min = t === "rest" ? 0 : minutes.get(d)!;
    const { title, description } = t === "race" && goal ? { title: goal.title, description: describe("race", min, sport.noun).description } : describe(t, min, sport.noun);
    days.push({
      day,
      type: t,
      title,
      durationMin: t === "race" ? 0 : min,
      targetLoad: Math.round((min / 60) * TSS_PER_H[t]),
      intensity: intensityText(t, inp, sport.power),
      description: rest.has(d) && t === "rest" ? `${description} (dein fester Ruhetag)` : description,
      key: isHard(t) && t !== "opener" ? true : t === "long" || t === "race",
      strength: null,
    });
  }
  const strengthDays = placeStrength(days, strengthWanted, rest, phase, habit.minutes);
  if (habit.estimated && strengthWanted) notes.push(`Kraft: ${habit.perWeek}× pro Woche à ~${habit.minutes} min wie in den letzten Wochen. Ändern über die Trainingsvorlieben.`);
  if (strengthDays < strengthWanted) notes.push(`Nur ${strengthDays} von ${strengthWanted} Krafteinheiten passten sinnvoll in die Woche: Kraft nicht vor harten Tagen, und ein Tag pro Woche bleibt ganz frei.`);
  if (strengthDays) notes.push(season.text);
  if (strengthDays) notes.push("Kraft nie direkt vor Intervallen oder der langen Fahrt: schwere Beine kosten sonst die Qualität der Radeinheit. Am selben Tag erst Rad, dann Kraft.");

  const planned = days.reduce((a, s) => a + s.targetLoad, 0);
  if (hasLoad && planned < targetLoad * 0.8) notes.push(`Mit ${hours} h erreicht der Plan etwa ${planned} von ${targetLoad} Belastungspunkten. Für mehr Fitnesszuwachs bräuchte es mehr Zeit oder Intensität.`);
  if (phase === "recovery") notes.push("Erholungswoche: Intensität raus, Umfang etwa 40 % weniger. Danach geht der Aufbau weiter.");
  if (raceDay != null) notes.push(`Wettkampf am ${WEEKDAY[raceDay]}. Am Tag davor nur kurz aktivieren oder frei.`);

  return {
    weekStart: week,
    phase,
    phaseReason: reason,
    goalId: goal?.id ?? null,
    targetLoad,
    targetHours: hours,
    days,
    notes,
    source: "rule",
  };
}

const STRENGTH_LOAD = 25;
const STRENGTH_FOCUS = ["Beine + Rumpf (schwer, wenige Wiederholungen)", "Oberkörper + Rumpf", "Ganzkörper (Beine moderat)", "Oberkörper (Zug)", "Rumpf + Mobility", "Oberkörper (Druck)"];
const LIGHT_FOCUS = "Ganzkörper leicht (Technik, ~60 % der üblichen Gewichte)";

/**
 * Verteilt Krafteinheiten. Regeln (Faustregeln für Rad + Kraft): nie am Tag vor Intervallen,
 * Langtag oder Wettkampf; bevorzugt an Tagen mit harter Radeinheit (danach, „harte Tage hart“)
 * oder an freien, nicht festen Ruhetagen; sonst nach einer lockeren Fahrt. Beintraining
 * möglichst früh in der Woche, weit weg vom Langtag.
 */
export function placeStrength(days: PlannedSession[], wanted: number, fixedRest: Set<number>, phase: Phase, minutes = 45): number {
  if (wanted <= 0) return 0;
  const light = phase === "taper" || phase === "recovery";
  const beforeHeavy = (i: number) => {
    const next = days[i + 1];
    return next != null && (isHard(next.type) || next.type === "long" || next.type === "race");
  };
  const afterLong = (i: number) => i > 0 && (days[i - 1].type === "long" || days[i - 1].type === "race");
  const score = (s: PlannedSession, i: number, legs: boolean): number | null => {
    if (s.strength || fixedRest.has(i) || s.type === "race" || s.type === "opener") return null;
    // Beine/Ganzkörper nie vor harten Tagen und nicht am Langtag; Oberkörper ist dort unkritisch.
    if (legs && (beforeHeavy(i) || s.type === "long")) return null;
    if (s.type === "long") return 0.5;
    if (s.type === "threshold" || s.type === "vo2max" || s.type === "tempo") return light ? null : 3;
    // Mindestens ein ganz freier Tag pro Woche bleibt frei (Erholung, auch bei täglicher Kraft-Gewohnheit).
    if (s.type === "rest") return days.filter((x) => x.type === "rest").length <= 1 ? null : afterLong(i) ? 1 : 2;
    if (s.type === "endurance") return 2.5;
    if (s.type === "recovery") return 1.5;
    return null;
  };
  let placed = 0;
  const used: number[] = [];
  while (placed < wanted) {
    let best = -1, bestScore = -Infinity;
    const focusNow = light ? LIGHT_FOCUS : STRENGTH_FOCUS[placed % STRENGTH_FOCUS.length];
    const legs = !/^Oberkörper/.test(focusNow);
    // Bis 3 Einheiten mindestens ein Tag dazwischen, bei mehr nur ein Tag je Einheit.
    const gap = wanted <= 3 ? 2 : 1;
    days.forEach((s, i) => {
      const sc = score(s, i, legs);
      if (sc == null) return;
      if (used.some((u) => Math.abs(u - i) < gap)) return;
      const spread = used.length ? Math.min(...used.map((u) => Math.abs(u - i))) * 0.2 : 0;
      const early = (6 - i) * 0.05;
      if (sc + spread + early > bestScore) (bestScore = sc + spread + early), (best = i);
    });
    if (best < 0) break;
    const s = days[best];
    const durationMin = light ? Math.min(40, minutes) : minutes;
    const focus = focusNow;
    s.strength = { durationMin, focus };
    s.targetLoad += light ? 15 : STRENGTH_LOAD;
    if (s.type === "rest") {
      s.type = "strength";
      s.title = "Krafttraining";
      s.intensity = intensityText("strength", { ftpW: null, thresholdHr: null, maxHr: null }, false);
      s.description = `${durationMin} min ${focus}. 3–4 Sätze, 1–2 Wiederholungen Reserve.`;
      s.durationMin = durationMin;
    } else {
      s.description += ` Danach Kraft: ${durationMin} min ${focus}.`;
    }
    used.push(best);
    placed++;
  }
  return placed;
}

// --- Soll/Ist ------------------------------------------------------------------------------

export interface ActualDay {
  day: string;
  load: number;
  minutes: number;
  sports: string[];
  /** Mindestens eine Krafteinheit an dem Tag. */
  strength: boolean;
}

export type DayStatus = "done" | "partial" | "missed" | "extra" | "rest" | "upcoming" | "today";

export interface ComparedDay extends PlannedSession {
  actualLoad: number;
  actualMin: number;
  actualSports: string[];
  status: DayStatus;
  /** Geplante Kraft erledigt (null = keine geplant). */
  strengthDone: boolean | null;
}

export interface PlanComparison {
  days: ComparedDay[];
  /** Bis einschließlich gestern (bzw. heute, wenn heute schon trainiert wurde). */
  plannedLoadToDate: number;
  actualLoadToDate: number;
  plannedMinToDate: number;
  actualMinToDate: number;
  sessionsPlannedToDate: number;
  sessionsDoneToDate: number;
  keySessionsMissed: string[];
  /** Ist / Soll der Belastung in Prozent (null ohne Soll). */
  compliancePct: number | null;
  summary: string;
}

const STRENGTH_SPORTS = ["weight", "strength", "bodybuilding", "powerlifting", "functional", "crossfit", "kraft", "gym"];
export const isStrengthSport = (sport: string | null | undefined) => !!sport && STRENGTH_SPORTS.some((k) => sport.toLowerCase().includes(k));

export function comparePlan(plan: WeekPlan, actual: ActualDay[], today: string): PlanComparison {
  const byDay = new Map(actual.map((a) => [a.day, a]));
  let pl = 0, al = 0, pm = 0, am = 0, sp = 0, sd = 0;
  const keyMissed: string[] = [];
  const days = plan.days.map((s): ComparedDay => {
    const a = byDay.get(s.day);
    const actualLoad = Math.round(a?.load ?? 0), actualMin = Math.round(a?.minutes ?? 0);
    const trained = actualMin > 0 || actualLoad > 0;
    const ratio = s.targetLoad > 0 ? actualLoad / s.targetLoad : s.durationMin > 0 ? actualMin / s.durationMin : 0;
    const ratioMin = s.durationMin > 0 ? actualMin / s.durationMin : 0;
    let status: DayStatus;
    if (s.type === "strength") status = a?.strength ? "done" : s.day > today ? "upcoming" : trained ? "partial" : s.day === today ? "today" : "missed";
    else if (s.type === "rest") status = trained ? "extra" : s.day > today ? "upcoming" : "rest";
    else if (s.day > today) status = "upcoming";
    // Harte Einheiten zählen nur mit genug Belastung als erledigt (lange locker fahren ersetzt keine Intervalle).
    else if (isHard(s.type) && actualLoad > 0 ? ratio >= 0.6 && ratioMin >= 0.5 : Math.max(ratio, ratioMin) >= 0.7) status = "done";
    else if (trained) status = "partial";
    else status = s.day === today ? "today" : "missed";

    const counts = s.day < today || (s.day === today && trained);
    if (counts) {
      pl += s.targetLoad; al += actualLoad; pm += s.durationMin; am += actualMin;
      if (s.type !== "rest") {
        sp++;
        if (status === "done") sd++;
      }
      if (s.key && status === "missed") keyMissed.push(`${s.title} (${s.day})`);
    }
    const strengthDone = s.strength ? Boolean(a?.strength) : null;
    return { ...s, actualLoad, actualMin, actualSports: a?.sports ?? [], status, strengthDone };
  });
  const compliancePct = pl > 0 ? Math.round((al / pl) * 100) : null;
  let summary: string;
  if (sp === 0) summary = "Die Woche hat gerade erst begonnen.";
  else {
    summary = `${sd} von ${sp} geplanten Einheiten erledigt, Belastung ${compliancePct ?? 0} % vom Soll.`;
    if (keyMissed.length) summary += ` Ausgefallen: ${keyMissed.join(", ")}.`;
    if (compliancePct != null && compliancePct > 130) summary += " Deutlich mehr als geplant – auf die Erholung achten.";
  }
  return {
    days,
    plannedLoadToDate: Math.round(pl),
    actualLoadToDate: Math.round(al),
    plannedMinToDate: pm,
    actualMinToDate: am,
    sessionsPlannedToDate: sp,
    sessionsDoneToDate: sd,
    keySessionsMissed: keyMissed,
    compliancePct,
    summary,
  };
}

// --- Prüfung gespeicherter Pläne (z. B. von Claude angepasst) -------------------------------

const SESSION_TYPES: SessionType[] = ["rest", "recovery", "endurance", "long", "tempo", "threshold", "vo2max", "strength", "opener", "race"];

/** Bringt einen eingereichten Plan in Form: 7 Tage der Woche, fehlende Tage = Ruhetag, Belastung geschätzt, falls leer. */
export type SessionInput = Partial<Omit<PlannedSession, "strength">> & { strength?: { durationMin: number; focus?: string } | null };

export function normalizePlan(week: string, input: { days: SessionInput[]; notes?: string[]; phase?: Phase; phaseReason?: string; goalId?: number | null }, base?: WeekPlan): WeekPlan {
  const ws = weekStart(week);
  const byDay = new Map<string, SessionInput>();
  for (const d of input.days) {
    if (!d.day) continue;
    if (weekStart(d.day) !== ws) throw new Error(`Tag ${d.day} liegt nicht in der Woche ab ${ws}.`);
    byDay.set(d.day, d);
  }
  const days: PlannedSession[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    const d = byDay.get(day);
    const type: SessionType = d?.type && SESSION_TYPES.includes(d.type) ? d.type : "rest";
    const durationMin = Math.max(0, Math.min(600, Math.round(d?.durationMin ?? 0)));
    days.push({
      day,
      type,
      title: (d?.title ?? describe(type, durationMin, "Einheit").title).slice(0, 80),
      durationMin,
      targetLoad: Math.max(0, Math.round(d?.targetLoad ?? (durationMin / 60) * TSS_PER_H[type])),
      intensity: (d?.intensity ?? "").slice(0, 120),
      description: (d?.description ?? "").slice(0, 500),
      key: d?.key ?? (isHard(type) || type === "long" || type === "race"),
      strength:
        d?.strength && d.strength.durationMin > 0
          ? { durationMin: Math.min(180, Math.round(d.strength.durationMin)), focus: String(d.strength.focus ?? "Ganzkörper").slice(0, 80) }
          : null,
    });
  }
  return {
    weekStart: ws,
    phase: input.phase ?? base?.phase ?? "maintain",
    phaseReason: input.phaseReason ?? base?.phaseReason ?? "",
    goalId: input.goalId ?? base?.goalId ?? null,
    targetLoad: base?.targetLoad ?? days.reduce((a, s) => a + s.targetLoad, 0),
    targetHours: Math.round((days.reduce((a, s) => a + s.durationMin, 0) / 60) * 4) / 4,
    days,
    notes: (input.notes ?? base?.notes ?? []).map((n) => String(n).slice(0, 300)).slice(0, 10),
    source: "coach",
  };
}
