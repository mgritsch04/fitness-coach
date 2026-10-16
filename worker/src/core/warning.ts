// Frühwarnung Überlastung/Infekt: mehrere Körpersignale gleichzeitig außerhalb der persönlichen
// Basis (Ruhepuls hoch, HRV niedrig, Atemfrequenz hoch, Hauttemperatur hoch, SpO2 niedrig).
// Ausdrücklich keine Diagnose – nur ein Hinweis, das Training anzupassen. Schwellen sind Faustregeln.
import { addDays, type DayPoint } from "./analysis";
import type { CoachAdvice, Readiness } from "./coach";

export type SignalKey = "rhr" | "hrv" | "respRate" | "skinTemp" | "spo2";

export interface Signal {
  key: SignalKey;
  label: string;
  day: string;
  value: number;
  baseline: number;
  /** Abweichung in Standardabweichungen der Basis (Richtung: positiv = ungünstig). */
  z: number;
  delta: number;
  unit: string;
  text: string;
}

export interface EarlyWarning {
  level: "none" | "watch" | "elevated" | "high";
  /** Auffällige Signale (ungünstige Richtung, über der Schwelle). */
  signals: Signal[];
  /** Tage in Folge mit mindestens zwei auffälligen Signalen. */
  streak: number;
  headline: string;
  text: string;
  disclaimer: string;
}

interface Rule {
  key: SignalKey;
  label: string;
  unit: string;
  /** +1: hoch ist ungünstig, −1: niedrig ist ungünstig. */
  dir: 1 | -1;
  /** Mindestabweichung absolut (zusätzlich zur Streuung), damit kleine Schwankungen nicht zählen. */
  minDelta: number;
  digits: number;
}

const RULES: Rule[] = [
  { key: "rhr", label: "Ruhepuls", unit: "S/min", dir: 1, minDelta: 3, digits: 0 },
  { key: "hrv", label: "HRV", unit: "ms", dir: -1, minDelta: 5, digits: 0 },
  { key: "respRate", label: "Atemfrequenz", unit: "/min", dir: 1, minDelta: 0.7, digits: 1 },
  { key: "skinTemp", label: "Hauttemperatur", unit: "°C", dir: 1, minDelta: 0.4, digits: 1 },
  { key: "spo2", label: "Sauerstoffsättigung", unit: "%", dir: -1, minDelta: 1.5, digits: 1 },
];

/** Ab dieser Abweichung (in Standardabweichungen der Basis) zählt ein Signal. */
const Z_LIMIT = 1.5;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

/** Signale eines Tages gegen die Basis der 28 Tage davor (Tage −35 … −8 vom Stichtag). */
export function signalsOn(series: DayPoint[], day: string): Signal[] {
  const out: Signal[] = [];
  const p = series.find((x) => x.day === day);
  if (!p) return out;
  for (const r of RULES) {
    const v = p[r.key];
    if (v == null) continue;
    const base = series.filter((x) => x.day >= addDays(day, -35) && x.day <= addDays(day, -8)).map((x) => x[r.key]).filter((x): x is number => x != null);
    if (base.length < 10) continue;
    const m = mean(base), s = Math.max(sd(base), 1e-6);
    const delta = (v - m) * r.dir;
    const z = delta / s;
    if (z >= Z_LIMIT && delta >= r.minDelta) {
      const shown = (n: number) => n.toFixed(r.digits).replace(".", ",");
      out.push({
        key: r.key, label: r.label, day, value: v, baseline: Number(m.toFixed(2)), z: Number(z.toFixed(1)), delta: Number(delta.toFixed(2)), unit: r.unit,
        text: `${r.label} ${shown(v)} ${r.unit} (${r.dir > 0 ? "+" : "−"}${shown(Math.abs(v - m))} gegenüber deiner Basis ${shown(m)})`,
      });
    }
  }
  return out;
}

/**
 * Bewertet heute (bzw. den letzten Tag mit Erholungswerten, wenn WHOOP heute noch nicht ausgewertet hat).
 * high: ≥ 3 Signale oder 2 Signale an 2 Tagen in Folge · elevated: 2 Signale · watch: 1 Signal.
 */
export function earlyWarning(series: DayPoint[], today: string): EarlyWarning {
  const hasRecovery = (d: string) => {
    const p = series.find((x) => x.day === d);
    return p != null && (p.rhr != null || p.hrv != null);
  };
  const day = hasRecovery(today) ? today : addDays(today, -1);
  const signals = signalsOn(series, day);
  let streak = signals.length >= 2 ? 1 : 0;
  if (streak) for (let d = addDays(day, -1); signalsOn(series, d).length >= 2 && streak < 14; d = addDays(d, -1)) streak++;

  const n = signals.length;
  const level: EarlyWarning["level"] = n >= 3 || (n >= 2 && streak >= 2) ? "high" : n === 2 ? "elevated" : n === 1 ? "watch" : "none";
  const list = signals.map((s) => s.text).join("; ");
  const HEAD = {
    none: "Keine Auffälligkeiten",
    watch: "Ein Wert auffällig",
    elevated: "Mehrere Werte auffällig – heute eher schonen",
    high: "Deutliches Warnsignal – heute schonen",
  } as const;
  const TEXT = {
    none: "Ruhepuls, HRV, Atemfrequenz, Hauttemperatur und Sauerstoffsättigung liegen im gewohnten Bereich.",
    watch: `${list}. Ein einzelner Ausreißer ist meist harmlos (Schlaf, Alkohol, spätes Essen, Stress). Im Blick behalten.`,
    elevated: `${list}. Mehrere Signale gleichzeitig können auf Überlastung oder einen beginnenden Infekt hindeuten. Heute locker oder frei, viel trinken, früh schlafen.`,
    high: `${list}${streak >= 2 ? ` – seit ${streak} Tagen` : ""}. Dein Körper zeigt mehrere Belastungszeichen gleichzeitig. Heute schonen und kein hartes Training. Wenn du dich krank fühlst oder Fieber hast: pausieren und bei Bedarf ärztlich abklären lassen.`,
  } as const;
  return {
    level,
    signals,
    streak,
    headline: HEAD[level],
    text: TEXT[level],
    disclaimer: "Hinweis aus deinen Messwerten, keine Diagnose. Messwerte von Wearables schwanken; dein Befinden zählt mit.",
  };
}

const LEVELS: Readiness[] = ["rest", "easy", "moderate", "hard"];
const HEADLINE: Record<Readiness, string> = {
  rest: "Heute Ruhe oder nur lockere Bewegung",
  easy: "Locker trainieren",
  moderate: "Normales Training",
  hard: "Bereit für eine harte Einheit",
};

/** high → höchstens Ruhe/locker (Ruhe ab 3 Signalen), elevated → höchstens locker. Nie härter. */
export function applyWarning(advice: CoachAdvice, w: EarlyWarning): CoachAdvice {
  if (w.level === "none" || w.level === "watch") return advice;
  const cap: Readiness = w.level === "high" && w.signals.length >= 3 ? "rest" : "easy";
  const out: CoachAdvice = { ...advice, reasons: [...advice.reasons], warnings: [...advice.warnings, `${w.headline}: ${w.text}`] };
  out.reasons.push({ factor: "warning", effect: "down", text: `${w.signals.length} Körpersignale gleichzeitig außerhalb deiner Basis.` });
  if (LEVELS.indexOf(advice.readiness) > LEVELS.indexOf(cap)) {
    out.readiness = cap;
    out.headline = HEADLINE[cap];
    out.suggestion = cap === "rest" ? "Heute frei oder nur Spaziergang. Erholung geht vor." : "Höchstens locker in Zone 1–2, kurz halten; kein Krafttraining mit schweren Gewichten.";
    out.score = Math.min(advice.score, cap === "rest" ? 30 : 50);
    if (advice.targetLoad) {
      const f = cap === "rest" ? 0.25 : 0.6;
      out.targetLoad = { min: Math.round(advice.targetLoad.min * f), max: Math.round(advice.targetLoad.max * f) };
    }
  }
  return out;
}
