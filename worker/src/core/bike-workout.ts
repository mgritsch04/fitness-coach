// Strukturierte Radeinheiten für die Rolle (#63): aus Typ und Dauer einer Planeinheit werden Intervalle in % FTP,
// daraus eine ZWO-Datei (XML-Format von Zwift), die der offizielle MyWhoosh Workout Builder (workout.mywhoosh.com) importiert.
// Reine Funktionen ohne D1. Trainingsempfehlungen nach gängigen Faustregeln, keine medizinische Diagnose;
// die Belastung ist eine Schätzung im TSS-Maßstab.
import type { SessionType } from "./plan";

export type StepKind = "warmup" | "steady" | "intervals" | "cooldown";

export interface Step {
  kind: StepKind;
  /** Gesamtdauer des Schritts in Sekunden (bei Intervallen alle Wiederholungen). */
  durationS: number;
  /** Anteil der FTP; bei warmup/cooldown Start und Ende der Rampe. */
  power?: number;
  powerLow?: number;
  powerHigh?: number;
  repeat?: number;
  onS?: number;
  offS?: number;
  onPower?: number;
  offPower?: number;
  label: string;
}

export interface BikeWorkout {
  type: SessionType;
  name: string;
  description: string;
  durationMin: number;
  steps: Step[];
  /** Geschätzte Belastung (TSS-Maßstab) und Intensitätsfaktor. */
  load: number;
  intensityFactor: number;
  /** Vorlage aus der Bibliothek (#221), sonst nicht gesetzt. */
  templateId?: string;
  level?: number;
}

/** Einheiten, die auf dem Rad gefahren werden. */
export const RIDE_TYPES: SessionType[] = ["recovery", "endurance", "long", "tempo", "threshold", "vo2max", "opener", "race"];

interface Block {
  on: number;
  off: number;
  onPower: number;
  offPower: number;
  min: number;
  max: number;
  label: string;
}

// Hauptteil je Typ: Intervalle (Sekunden, Anteil FTP) und Grenzen für die Zahl der Wiederholungen.
const BLOCKS: Partial<Record<SessionType, Block>> = {
  tempo: { on: 900, off: 300, onPower: 0.85, offPower: 0.6, min: 1, max: 4, label: "Tempo (Sweet Spot)" },
  threshold: { on: 600, off: 300, onPower: 0.97, offPower: 0.55, min: 2, max: 5, label: "Schwelle" },
  vo2max: { on: 180, off: 180, onPower: 1.15, offPower: 0.5, min: 3, max: 6, label: "VO2max" },
  opener: { on: 60, off: 120, onPower: 1.1, offPower: 0.55, min: 3, max: 3, label: "Aktivierung" },
  race: { on: 60, off: 120, onPower: 1.1, offPower: 0.55, min: 3, max: 3, label: "Aktivierung" },
};

const NAMES: Record<string, string> = {
  recovery: "Locker ausrollen", endurance: "Grundlage", long: "Lange Grundlage", tempo: "Tempo", threshold: "Schwelle",
  vo2max: "VO2max", opener: "Vorbelastung", race: "Vorbelastung (Renntag)",
};

const ENDURANCE = 0.68;
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Baut eine Radeinheit aus Typ und Dauer. Liefert null für Einheiten ohne Rad (Ruhetag, Kraft).
 * Aufbau: Einfahren, Hauptteil, Rest der Zeit in Grundlage, Ausfahren.
 */
export function buildBikeWorkout(type: SessionType, durationMin: number): BikeWorkout | null {
  if (!RIDE_TYPES.includes(type)) return null;
  const total = Math.max(20, Math.min(360, Math.round(durationMin))) * 60;
  const block = BLOCKS[type];
  const steps: Step[] = [];
  if (type === "recovery") {
    steps.push({ kind: "warmup", durationS: 300, powerLow: 0.4, powerHigh: 0.5, label: "Einrollen" });
    steps.push({ kind: "steady", durationS: total - 600, power: 0.5, label: "sehr locker, Zone 1" });
    steps.push({ kind: "cooldown", durationS: 300, powerLow: 0.5, powerHigh: 0.4, label: "Ausrollen" });
  } else if (!block) {
    const warm = Math.min(900, Math.round(total * 0.12 / 60) * 60 || 300), cool = Math.min(600, Math.round(total * 0.08 / 60) * 60 || 300);
    steps.push({ kind: "warmup", durationS: warm, powerLow: 0.5, powerHigh: ENDURANCE, label: "Einfahren" });
    steps.push({ kind: "steady", durationS: total - warm - cool, power: ENDURANCE, label: "Grundlage, Zone 2, gleichmäßig" });
    steps.push({ kind: "cooldown", durationS: cool, powerLow: 0.6, powerHigh: 0.45, label: "Ausfahren" });
  } else {
    const warm = 900, cool = 600, room = total - warm - cool;
    const repeat = Math.max(block.min, Math.min(block.max, Math.floor(room / (block.on + block.off))));
    const main = repeat * (block.on + block.off);
    steps.push({ kind: "warmup", durationS: warm, powerLow: 0.5, powerHigh: 0.75, label: "Einfahren" });
    // Rest bis zur geplanten Dauer: vor dem Hauptteil in Grundlage (ist die Einheit kürzer, wird sie entsprechend länger).
    const rest = room - main;
    if (rest >= 120) steps.push({ kind: "steady", durationS: rest, power: ENDURANCE, label: "Grundlage" });
    steps.push({ kind: "intervals", durationS: main, repeat, onS: block.on, offS: block.off, onPower: block.onPower, offPower: block.offPower,
      label: `${repeat} × ${fmtDur(block.on)} ${block.label} (${pct(block.onPower)}), ${fmtDur(block.off)} locker` });
    steps.push({ kind: "cooldown", durationS: cool, powerLow: 0.6, powerHigh: 0.45, label: "Ausfahren" });
  }
  const { load, intensityFactor } = estimateLoad(steps);
  const durationS = steps.reduce((a, s) => a + s.durationS, 0);
  const main = steps.find((s) => s.kind === "intervals");
  return {
    type,
    name: `${NAMES[type]} ${Math.round(durationS / 60)} min`,
    description: main ? `Hauptteil: ${main.label}. Prozentwerte beziehen sich auf deine FTP.` : `${steps[1]?.label ?? ""}. Prozentwerte beziehen sich auf deine FTP.`,
    durationMin: Math.round(durationS / 60),
    steps,
    load,
    intensityFactor,
  };
}

/** Normalisierte Leistung grob aus den Schritten (4. Potenz gemittelt), daraus IF und TSS. */
export function estimateLoad(steps: readonly Step[]) {
  let t = 0, p4 = 0;
  for (const s of steps) {
    if (s.kind === "intervals") {
      const on = (s.onS ?? 0) * (s.repeat ?? 1), off = (s.offS ?? 0) * (s.repeat ?? 1);
      p4 += on * (s.onPower ?? 0) ** 4 + off * (s.offPower ?? 0) ** 4; t += on + off;
    } else {
      const p = s.power ?? ((s.powerLow ?? 0) + (s.powerHigh ?? 0)) / 2;
      p4 += s.durationS * p ** 4; t += s.durationS;
    }
  }
  const intensityFactor = t ? round2((p4 / t) ** 0.25) : 0;
  return { intensityFactor, load: Math.round((t / 3600) * intensityFactor ** 2 * 100) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f2 = (x: number | undefined) => (x ?? 0).toFixed(2);

/** ZWO-XML für den MyWhoosh Workout Builder (und Zwift). */
export function toZwo(w: BikeWorkout): string {
  const rows = w.steps.map((s) => {
    switch (s.kind) {
      case "warmup": return `    <Warmup Duration="${s.durationS}" PowerLow="${f2(s.powerLow)}" PowerHigh="${f2(s.powerHigh)}"/>`;
      case "cooldown": return `    <Cooldown Duration="${s.durationS}" PowerLow="${f2(s.powerLow)}" PowerHigh="${f2(s.powerHigh)}"/>`;
      case "steady": return `    <SteadyState Duration="${s.durationS}" Power="${f2(s.power)}"/>`;
      case "intervals": return `    <IntervalsT Repeat="${s.repeat}" OnDuration="${s.onS}" OffDuration="${s.offS}" OnPower="${f2(s.onPower)}" OffPower="${f2(s.offPower)}"/>`;
    }
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<workout_file>`,
    `  <author>Fitness Coach</author>`,
    `  <name>${esc(w.name)}</name>`,
    `  <description>${esc(w.description)}</description>`,
    `  <sportType>bike</sportType>`,
    `  <tags/>`,
    `  <workout>`,
    ...rows,
    `  </workout>`,
    `</workout_file>`,
    ``,
  ].join("\n");
}

/** Dateiname ohne Sonderzeichen, z. B. 2026-03-31-schwelle-60min.zwo */
export function zwoFileName(w: BikeWorkout, day: string | null) {
  const slug = (w.templateId ? w.name.replace(/\s*\d+ min$/, "") : NAMES[w.type]).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${day ? `${day}-` : ""}${slug}-${w.durationMin}min.zwo`;
}

function fmtDur(s: number) { return s % 60 ? `${s} s` : `${s / 60} min`; }
function pct(x: number) { return `${Math.round(x * 100)} % FTP`; }

// ---------------------------------------------------------------------------------------------------------------
// Workout-Bibliothek (#221): bewährte Einheiten je Typ in 3–4 Stufen, feste Dauer, Auswahl nach Zeit und Tagesform.

export type LibraryCategory = "recovery" | "endurance" | "sweetspot" | "threshold" | "vo2max";

export interface WorkoutTemplate {
  id: string;
  category: LibraryCategory;
  /** Planeinheit, der die Vorlage entspricht (für Zonen-Ziele und Dateiname). */
  type: SessionType;
  /** Stufe 1 (Einstieg) bis 4 (fordernd). */
  level: 1 | 2 | 3 | 4;
  title: string;
  /** Hauptteil in Worten. */
  main: string;
  steps: Step[];
}

export const CATEGORY_LABELS: Record<LibraryCategory, string> = {
  recovery: "Locker", endurance: "Grundlage", sweetspot: "Sweet Spot", threshold: "Schwelle", vo2max: "VO2max",
};

const W = (min: number, lo = 0.5, hi = 0.75): Step => ({ kind: "warmup", durationS: min * 60, powerLow: lo, powerHigh: hi, label: "Einfahren" });
const C = (min: number, lo = 0.6, hi = 0.45): Step => ({ kind: "cooldown", durationS: min * 60, powerLow: lo, powerHigh: hi, label: "Ausfahren" });
const S = (min: number, p: number, label: string): Step => ({ kind: "steady", durationS: Math.round(min * 60), power: p, label });
const I = (repeat: number, onS: number, offS: number, onPower: number, offPower: number, what: string): Step => ({
  kind: "intervals", durationS: repeat * (onS + offS), repeat, onS, offS, onPower, offPower,
  label: `${repeat} × ${fmtDur(onS)} ${what} (${pct(onPower)}), ${fmtDur(offS)} locker`,
});

/** Die Bibliothek. Prozentwerte der FTP nach gängigen Faustregeln. */
export const LIBRARY: readonly WorkoutTemplate[] = [
  { id: "rec-30", category: "recovery", type: "recovery", level: 1, title: "Ausrollen", main: "20 min sehr locker",
    steps: [W(5, 0.4, 0.5), S(20, 0.5, "sehr locker, Zone 1"), C(5, 0.5, 0.4)] },
  { id: "rec-45", category: "recovery", type: "recovery", level: 2, title: "Lockere Runde", main: "35 min locker mit hoher Trittfrequenz",
    steps: [W(5, 0.4, 0.52), S(35, 0.53, "locker, Zone 1, 95–100 U/min"), C(5, 0.52, 0.4)] },
  { id: "rec-60", category: "recovery", type: "recovery", level: 3, title: "Aktive Erholung", main: "50 min locker",
    steps: [W(5, 0.4, 0.55), S(50, 0.55, "locker, Zone 1"), C(5, 0.55, 0.4)] },

  { id: "end-60", category: "endurance", type: "endurance", level: 1, title: "Grundlage kurz", main: "45 min Zone 2",
    steps: [W(10, 0.5, 0.68), S(45, 0.68, "Grundlage, Zone 2"), C(5)] },
  { id: "end-cad-75", category: "endurance", type: "endurance", level: 2, title: "Grundlage mit Kadenz", main: "5 × 2 min hohe Trittfrequenz in Zone 2",
    steps: [W(10, 0.5, 0.68), I(5, 120, 480, 0.72, 0.68, "110 U/min"), S(10, 0.68, "Grundlage"), C(5)] },
  { id: "end-90", category: "endurance", type: "endurance", level: 3, title: "Grundlage lang", main: "75 min Zone 2",
    steps: [W(10, 0.5, 0.7), S(75, 0.7, "Grundlage, Zone 2"), C(5)] },
  { id: "end-tempo-120", category: "endurance", type: "long", level: 4, title: "Grundlage mit Tempo", main: "100 min Zone 2 mit 2 × 15 min Tempo",
    steps: [W(10, 0.5, 0.7), S(30, 0.7, "Grundlage"), I(2, 900, 900, 0.8, 0.68, "Tempo"), S(10, 0.7, "Grundlage"), C(10)] },

  { id: "ss-3x10", category: "sweetspot", type: "tempo", level: 1, title: "Sweet Spot 3 × 10", main: "3 × 10 min bei 88 %",
    steps: [W(10), I(3, 600, 300, 0.88, 0.55, "Sweet Spot"), C(10)] },
  { id: "ss-3x12", category: "sweetspot", type: "tempo", level: 2, title: "Sweet Spot 3 × 12", main: "3 × 12 min bei 90 %",
    steps: [W(10), I(3, 720, 240, 0.9, 0.55, "Sweet Spot"), C(10)] },
  { id: "ss-2x20", category: "sweetspot", type: "tempo", level: 3, title: "Sweet Spot 2 × 20", main: "2 × 20 min bei 90 %",
    steps: [W(15), I(2, 1200, 300, 0.9, 0.55, "Sweet Spot"), C(10)] },
  { id: "ss-3x20", category: "sweetspot", type: "tempo", level: 4, title: "Sweet Spot 3 × 20", main: "3 × 20 min bei 92 %",
    steps: [W(15), I(3, 1200, 300, 0.92, 0.55, "Sweet Spot"), C(10)] },

  { id: "th-4x8", category: "threshold", type: "threshold", level: 1, title: "Schwelle 4 × 8", main: "4 × 8 min bei 95 %",
    steps: [W(15), I(4, 480, 240, 0.95, 0.55, "Schwelle"), C(10)] },
  { id: "th-3x12", category: "threshold", type: "threshold", level: 2, title: "Schwelle 3 × 12", main: "3 × 12 min bei 97 %",
    steps: [W(15), I(3, 720, 300, 0.97, 0.55, "Schwelle"), C(10)] },
  { id: "th-ou", category: "threshold", type: "threshold", level: 3, title: "Over-Under", main: "3 Blöcke à 4 × (2 min 95 %, 1 min 105 %)",
    steps: [W(15), I(4, 60, 120, 1.05, 0.95, "über der Schwelle"), S(5, 0.55, "locker"), I(4, 60, 120, 1.05, 0.95, "über der Schwelle"), S(5, 0.55, "locker"),
      I(4, 60, 120, 1.05, 0.95, "über der Schwelle"), C(10)] },
  { id: "th-2x20", category: "threshold", type: "threshold", level: 4, title: "Schwelle 2 × 20", main: "2 × 20 min bei 100 %",
    steps: [W(15), I(2, 1200, 480, 1, 0.55, "Schwelle"), C(10)] },

  { id: "vo-5x3", category: "vo2max", type: "vo2max", level: 1, title: "VO2max 5 × 3", main: "5 × 3 min bei 112 %",
    steps: [W(15), I(5, 180, 180, 1.12, 0.5, "VO2max"), C(10)] },
  { id: "vo-30-30", category: "vo2max", type: "vo2max", level: 2, title: "30/30", main: "2 × 10 × (30 s 125 %, 30 s locker)",
    steps: [W(15), I(10, 30, 30, 1.25, 0.5, "hart"), S(5, 0.55, "locker"), I(10, 30, 30, 1.25, 0.5, "hart"), C(10)] },
  { id: "vo-5x4", category: "vo2max", type: "vo2max", level: 3, title: "VO2max 5 × 4", main: "5 × 4 min bei 115 %",
    steps: [W(15), I(5, 240, 240, 1.15, 0.5, "VO2max"), C(10)] },
  { id: "vo-6x4", category: "vo2max", type: "vo2max", level: 4, title: "VO2max 6 × 4", main: "6 × 4 min bei 118 %",
    steps: [W(15), I(6, 240, 180, 1.18, 0.5, "VO2max"), C(10)] },
];

/** Vorlage als fertige Radeinheit (gleiches Format wie buildBikeWorkout, also auch toZwo). */
export function templateWorkout(t: WorkoutTemplate): BikeWorkout {
  const { load, intensityFactor } = estimateLoad(t.steps);
  const durationMin = Math.round(t.steps.reduce((a, s) => a + s.durationS, 0) / 60);
  return {
    type: t.type,
    name: `${t.title} ${durationMin} min`,
    description: `${CATEGORY_LABELS[t.category]}, Stufe ${t.level} von 4. Hauptteil: ${t.main}. Prozentwerte beziehen sich auf deine FTP.`,
    durationMin,
    steps: t.steps.map((s) => ({ ...s })),
    load,
    intensityFactor,
    templateId: t.id,
    level: t.level,
  };
}

export const findTemplate = (id: string) => LIBRARY.find((t) => t.id === id) ?? null;

/** Ab welcher Erholung (WHOOP, %) welche Arten passen: rot nur locker/Grundlage, gelb ohne VO2max und ohne Stufe 4. */
export function suitsReadiness(t: Pick<WorkoutTemplate, "category" | "level">, recovery: number | null) {
  if (recovery == null || recovery >= 67) return true;
  if (recovery < 34) return t.category === "recovery" || (t.category === "endurance" && t.level <= 2);
  return t.category !== "vo2max" && t.level <= 3;
}

/** Auswahl nach verfügbarer Zeit, Art und Tagesform; passende zuerst, dann nach Art und Stufe. */
export function pickWorkouts(opts: { maxMin?: number | null; category?: LibraryCategory | null; recovery?: number | null }) {
  const order = Object.keys(CATEGORY_LABELS);
  const items = LIBRARY.map(templateWorkout)
    .map((w) => {
      const t = findTemplate(w.templateId!)!;
      return { id: t.id, category: t.category, categoryLabel: CATEGORY_LABELS[t.category], type: t.type, level: t.level, title: t.title, main: t.main,
        name: w.name, durationMin: w.durationMin, load: w.load, intensityFactor: w.intensityFactor, suited: suitsReadiness(t, opts.recovery ?? null) };
    })
    .filter((x) => (opts.maxMin ? x.durationMin <= opts.maxMin : true) && (opts.category ? x.category === opts.category : true))
    .sort((a, b) => Number(b.suited) - Number(a.suited) || order.indexOf(a.category) - order.indexOf(b.category) || a.level - b.level);
  const r = opts.recovery ?? null;
  const hint = r == null ? "Keine Erholung für heute; alle Einheiten stehen zur Wahl."
    : r < 34 ? `Erholung ${r} % (rot): heute nur locker oder kurze Grundlage.`
    : r < 67 ? `Erholung ${r} % (gelb): kein VO2max und keine Stufe 4, Schwelle und Sweet Spot gehen.`
    : `Erholung ${r} % (grün): alles möglich, gute Gelegenheit für eine harte Einheit.`;
  return { recovery: r, items, hint };
}
