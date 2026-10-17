// Wiedereinstieg nach Krankheit oder Pause (#201): Pause erkennen (≥ 4 Tage ohne Training oder Tagebuch
// „krank“/„verletzt“) und für 1–2 Wochen gestuft steigern: erst locker und kurz, dann Grundlage und leichte
// Kraft, zuletzt wieder etwas Intensität. Abbruchregel über Ruhepuls und HRV.
// Reine Funktion; Trainingsempfehlung, keine Diagnose.
import { addDays, daysBetween, type DayPoint } from "./analysis";
import type { CoachAdvice, Readiness } from "./coach";
import { normalizeTag, type JournalEntry } from "./journal";

export type BreakReason = "pause" | "sick" | "injured";

export interface ReturnStage {
  stage: 1 | 2 | 3;
  label: string;
  /** Anteil der üblichen Dauer. */
  durationPct: number;
  intensity: string;
  strength: string;
  /** Höchste Tagesform-Stufe, die der Coach in dieser Stufe empfiehlt. */
  cap: Readiness;
}

export interface ReturnToTraining {
  /** sick = heute noch krank eingetragen: erst gesund werden. return = Wiedereinstieg läuft. */
  status: "sick" | "return";
  reason: BreakReason;
  breakFrom: string;
  breakTo: string;
  breakDays: number;
  /** Tag des Wiedereinstiegs (1 = erster Tag nach der Pause); null solange krank. */
  day: number | null;
  totalDays: number;
  stage: ReturnStage | null;
  /** Ruhepuls/HRV deutlich daneben: Stufe halten bzw. Pause. */
  abort: string | null;
  text: string;
  disclaimer: string;
}

const SICK = ["krank", "erkältet", "fieber", "infekt", "sick"];
const INJURED = ["verletzt", "schmerzen", "injury"];
const tagged = (e: JournalEntry, words: string[]) => e.tags.map(normalizeTag).some((t) => words.some((w) => t.includes(w)));

const STAGES: ReturnStage[] = [
  { stage: 1, label: "Stufe 1: locker bewegen", durationPct: 50, intensity: "nur Zone 1–2, sprechen muss leicht gehen", strength: "keine Kraft oder nur Mobility", cap: "easy" },
  { stage: 2, label: "Stufe 2: Grundlage", durationPct: 75, intensity: "Zone 2, keine Intervalle", strength: "Kraft leicht (etwa 60 % der Gewichte, wenige Sätze)", cap: "moderate" },
  { stage: 3, label: "Stufe 3: fast normal", durationPct: 100, intensity: "Grundlage normal, höchstens eine moderate Tempo-Einheit", strength: "Kraft normal, schwere Beine erst am Ende der Stufe", cap: "moderate" },
];

export const RETURN_DISCLAIMER = "Trainingsempfehlung, keine Diagnose. Bei Fieber, Brustschmerz, Atemnot oder Herzstolpern nicht trainieren und ärztlich abklären lassen.";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/** Letzte Pause, die höchstens 14 Tage zurück endet: Krankheits-Tage aus dem Tagebuch oder ≥ 4 Tage ohne Training. */
function findBreak(series: DayPoint[], journal: JournalEntry[], today: string): { from: string; to: string; reason: BreakReason } | null {
  const marked = new Map<string, BreakReason>();
  for (const e of journal) {
    if (e.day > today || e.day < addDays(today, -21)) continue;
    if (tagged(e, SICK)) marked.set(e.day, "sick");
    else if (tagged(e, INJURED)) marked.set(e.day, "injured");
  }
  // Tagebuch zuerst: letzte zusammenhängende Folge markierter Tage (Lücken von einem Tag zählen mit).
  const days = [...marked.keys()].sort();
  if (days.length) {
    const to = days.at(-1)!;
    let from = to;
    for (let i = days.length - 2; i >= 0 && daysBetween(days[i], from) <= 2; i--) from = days[i];
    if (to >= addDays(today, -14)) {
      const reason = [...marked.entries()].some(([d, r]) => d >= from && r === "sick") ? "sick" : "injured";
      return { from, to, reason };
    }
  }
  // Sonst: jüngste Folge von ≥ 4 Tagen ohne Training, die in den letzten 14 Tagen endet (heute zählt nicht, der Tag läuft noch).
  const byDay = new Map(series.map((d) => [d.day, d]));
  const rest = (d: string) => byDay.get(d)?.workouts === 0;
  let end: string | null = null, start: string | null = null;
  for (let d = addDays(today, -1); d >= addDays(today, -14) && byDay.has(d); d = addDays(d, -1)) {
    if (!rest(d)) continue;
    let s = d;
    while (rest(addDays(s, -1))) s = addDays(s, -1);
    if (daysBetween(s, d) + 1 >= 4) { end = d; start = s; break; }
    d = s;
  }
  if (!end || !start) return null;
  // Nur wenn vorher regelmäßig trainiert wurde (sonst fehlen vermutlich nur Daten).
  const before = series.filter((p) => p.day < start! && p.day >= addDays(start!, -14));
  if (before.length < 10 || before.filter((p) => p.workouts > 0).length < 5) return null;
  return { from: start, to: end, reason: "pause" };
}

export function returnToTraining(series: DayPoint[], journal: JournalEntry[], today: string): ReturnToTraining | null {
  const br = findBreak(series, journal, today);
  if (!br) return null;
  const breakDays = daysBetween(br.from, br.to) + 1;
  const base = { reason: br.reason, breakFrom: br.from, breakTo: br.to, breakDays, disclaimer: RETURN_DISCLAIMER };
  const what = br.reason === "sick" ? "Krankheit" : br.reason === "injured" ? "Verletzung" : "Pause";
  // Kürzere Pausen brauchen weniger Anlauf; nach Krankheit vorsichtiger.
  const totalDays = Math.min(14, Math.max(br.reason === "pause" ? 4 : 6, br.reason === "pause" ? breakDays : breakDays * 2));

  if (br.to === today && br.reason !== "pause") {
    return {
      ...base, status: "sick", day: null, totalDays, stage: null, abort: null,
      text: br.reason === "sick"
        ? `Heute „krank“ eingetragen: nicht trainieren. Der Wiedereinstieg startet, wenn du dich einen Tag lang wieder gesund fühlst (kein „krank“ mehr im Check-in).`
        : `Heute „verletzt“ eingetragen: nur schmerzfrei bewegen. Der Wiedereinstieg startet, sobald du ohne Schmerzen trainieren kannst.`,
    };
  }
  const day = daysBetween(br.to, today);
  if (day < 1 || day > totalDays) return null;
  const third = totalDays / 3;
  const stage = STAGES[day <= Math.ceil(third) ? 0 : day <= Math.ceil(2 * third) ? 1 : 2];

  // Abbruchregel: Ruhepuls oder HRV heute deutlich schlechter als vor der Pause.
  const pre = series.filter((p) => p.day < br.from && p.day >= addDays(br.from, -30));
  const rhrBase = median(pre.flatMap((p) => (p.rhr != null ? [p.rhr] : [])));
  const hrvBase = median(pre.flatMap((p) => (p.hrv != null ? [p.hrv] : [])));
  const now = series.find((p) => p.day === today);
  const flags: string[] = [];
  if (now?.rhr != null && rhrBase != null && now.rhr >= rhrBase + 5) flags.push(`Ruhepuls ${Math.round(now.rhr - rhrBase)} Schläge über dem Wert vor der ${what}`);
  if (now?.hrv != null && hrvBase != null && now.hrv <= hrvBase * 0.85) flags.push(`HRV ${Math.round((1 - now.hrv / hrvBase) * 100)} % unter dem Wert vor der ${what}`);
  const abort = flags.length ? `${flags.join(", ")}: heute nicht steigern, Stufe halten oder einen Tag pausieren.` : null;

  return {
    ...base, status: "return", day, totalDays, stage, abort,
    text: `Wiedereinstieg nach ${breakDays} Tagen ${what}, Tag ${day} von ${totalDays}. ${stage.label}: etwa ${stage.durationPct} % der üblichen Dauer, ${stage.intensity}; ${stage.strength}.${abort ? ` ${abort}` : ""}`,
  };
}

const LEVELS: Readiness[] = ["rest", "easy", "moderate", "hard"];

/** Deckelt die Tagesempfehlung während des Wiedereinstiegs (macht sie nie härter). */
export function applyReturn(advice: CoachAdvice, r: ReturnToTraining | null): CoachAdvice {
  if (!r) return advice;
  const cap: Readiness = r.status === "sick" ? "rest" : r.abort ? (r.stage!.stage === 1 ? "rest" : "easy") : r.stage!.cap;
  const out: CoachAdvice = { ...advice, reasons: [...advice.reasons, { factor: "return", effect: "down", text: r.text }], warnings: [...advice.warnings] };
  if (LEVELS.indexOf(advice.readiness) <= LEVELS.indexOf(cap)) return out;
  out.readiness = cap;
  out.score = Math.min(advice.score, cap === "rest" ? 25 : cap === "easy" ? 50 : 70);
  out.headline = cap === "rest" ? "Heute Ruhe" : cap === "easy" ? "Wiedereinstieg: heute locker" : "Wiedereinstieg: moderat, keine harten Intervalle";
  out.suggestion = r.text;
  if (advice.targetLoad) {
    const f = cap === "rest" ? 0.25 : cap === "easy" ? 0.5 : 0.8;
    out.targetLoad = { min: Math.round(advice.targetLoad.min * f), max: Math.round(advice.targetLoad.max * f) };
  }
  return out;
}
