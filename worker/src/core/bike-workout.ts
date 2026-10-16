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
  const slug = NAMES[w.type].toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${day ? `${day}-` : ""}${slug}-${w.durationMin}min.zwo`;
}

function fmtDur(s: number) { return s % 60 ? `${s} s` : `${s / 60} min`; }
function pct(x: number) { return `${Math.round(x * 100)} % FTP`; }
