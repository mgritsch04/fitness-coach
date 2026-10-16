// Frühwarnung (#24): mehrere Körpersignale gleichzeitig außerhalb der persönlichen Basis – Ruhepuls hoch,
// HRV niedrig, Atemfrequenz hoch, Hauttemperatur hoch, SpO2 niedrig – deuten auf Überlastung oder einen
// beginnenden Infekt hin. Trainingshinweis, ausdrücklich keine Diagnose. Reine Funktionen ohne D1.
import { addDays, type DayPoint } from "./analysis";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

export type WarningLevel = "none" | "watch" | "caution" | "alert";
type SignalKey = "rhr" | "hrv" | "respRate" | "skinTemp" | "spo2";

interface Rule {
  key: SignalKey;
  label: string;
  unit: string;
  /** +1: auffällig, wenn höher als üblich; −1: wenn niedriger. */
  dir: 1 | -1;
  /** Mindestabweichung in Einheiten UND in Standardabweichungen (beides nötig, damit kleine Schwankungen nicht zählen). */
  minAbs: number;
  minZ: number;
  text: (delta: number) => string;
}

const f1 = (x: number) => x.toFixed(1).replace(".", ",");

/** Schwellen: gängige Faustregeln (z. B. Ruhepuls +5, Atemfrequenz +1/min, Hauttemperatur +0,5 °C), als Schätzung. */
const RULES: Rule[] = [
  { key: "rhr", label: "Ruhepuls", unit: "bpm", dir: 1, minAbs: 4, minZ: 1.5, text: (d) => `Ruhepuls ${Math.round(d)} Schläge über deiner Basis` },
  { key: "hrv", label: "HRV", unit: "ms", dir: -1, minAbs: 0, minZ: 1.5, text: (d) => `HRV ${Math.round(-d)} ms unter deiner Basis` },
  { key: "respRate", label: "Atemfrequenz", unit: "/min", dir: 1, minAbs: 0.8, minZ: 2, text: (d) => `Atemfrequenz ${f1(d)} Atemzüge/min über deiner Basis` },
  { key: "skinTemp", label: "Hauttemperatur", unit: "°C", dir: 1, minAbs: 0.4, minZ: 2, text: (d) => `Hauttemperatur ${f1(d)} °C über deiner Basis` },
  { key: "spo2", label: "Sauerstoffsättigung", unit: "%", dir: -1, minAbs: 1.5, minZ: 2, text: (d) => `Sauerstoffsättigung ${f1(-d)} Prozentpunkte unter deiner Basis` },
];

export interface Signal {
  key: SignalKey;
  label: string;
  unit: string;
  value: number;
  baseline: number;
  delta: number;
  z: number | null;
  /** Wert liegt außerhalb der Basis in der ungünstigen Richtung. */
  flagged: boolean;
  text: string | null;
}

export interface EarlyWarning {
  /** Tag der ausgewerteten Messwerte (heute oder gestern, falls heute noch nichts da ist). */
  day: string | null;
  level: WarningLevel;
  flaggedCount: number;
  /** Wie viele Tage in Folge (bis `day`) mindestens zwei Signale auffällig waren. */
  consecutiveDays: number;
  signals: Signal[];
  headline: string;
  advice: string;
  disclaimer: string;
}

const DISCLAIMER =
  "Hinweis aus deinen Messwerten, keine medizinische Diagnose. Wenn du dich krank fühlst oder Beschwerden hast, kein hartes Training und im Zweifel ärztlich abklären.";

const HEADLINE: Record<WarningLevel, string> = {
  none: "Körpersignale im normalen Bereich",
  watch: "Ein Signal auffällig – beobachten",
  caution: "Mehrere Signale auffällig – heute schonen",
  alert: "Viele Signale auffällig – Ruhetag",
};

const ADVICE: Record<WarningLevel, string> = {
  none: "Keine Auffälligkeiten bei Ruhepuls, HRV, Atemfrequenz, Hauttemperatur und Sauerstoffsättigung.",
  watch: "Training wie geplant möglich, aber auf das Körpergefühl achten. Morgen wieder prüfen.",
  caution: "Heute nur locker (Zone 1–2) oder Ruhetag. Auf Schlaf, Trinken und Stress achten; harte Einheiten verschieben, bis die Werte zurück sind.",
  alert: "Heute Ruhetag. Mehrere Werte weichen gleichzeitig ab – das passt oft zu Überlastung oder einem beginnenden Infekt. Erst wieder hart trainieren, wenn die Werte normal sind und du dich gut fühlst.",
};

/** Signale eines Tages gegen die Basis aus den Tagen −34 … −7 davor (mindestens 7 Werte). */
export function signalsFor(series: readonly DayPoint[], day: string): Signal[] {
  const byDay = new Map(series.map((p) => [p.day, p]));
  const cur = byDay.get(day);
  if (!cur) return [];
  const out: Signal[] = [];
  for (const r of RULES) {
    const value = cur[r.key];
    if (value == null) continue;
    const base: number[] = [];
    for (let d = addDays(day, -34); d <= addDays(day, -7); d = addDays(d, 1)) {
      const v = byDay.get(d)?.[r.key];
      if (v != null) base.push(v);
    }
    if (base.length < 7) continue;
    const b = mean(base)!, s = sd(base);
    const delta = value - b;
    const z = s ? delta / s : null;
    const dirDelta = delta * r.dir;
    const flagged = dirDelta > 0 && dirDelta >= r.minAbs && (z == null || z * r.dir >= r.minZ);
    out.push({ key: r.key, label: r.label, unit: r.unit, value, baseline: round(b, 2)!, delta: round(delta, 2)!, z: round(z, 2), flagged, text: flagged ? r.text(delta) : null });
  }
  return out;
}

const levelOf = (flagged: number, consecutive: number): WarningLevel => {
  if (flagged >= 3 || (flagged >= 2 && consecutive >= 2)) return "alert";
  if (flagged >= 2) return "caution";
  return flagged === 1 ? "watch" : "none";
};

/** Frühwarnung für heute (bzw. gestern, wenn heute noch keine Messwerte vorliegen). */
export function earlyWarning(series: readonly DayPoint[], today: string): EarlyWarning {
  const has = (d: string) => signalsFor(series, d).length > 0;
  const day = has(today) ? today : has(addDays(today, -1)) ? addDays(today, -1) : null;
  if (!day) {
    return { day: null, level: "none", flaggedCount: 0, consecutiveDays: 0, signals: [], headline: "Noch zu wenig Daten für die Frühwarnung", advice: "Die Frühwarnung braucht etwa 2 Wochen Messwerte als persönliche Basis.", disclaimer: DISCLAIMER };
  }
  const signals = signalsFor(series, day);
  const flaggedCount = signals.filter((s) => s.flagged).length;
  let consecutiveDays = 0;
  for (let d = day; consecutiveDays < 14; d = addDays(d, -1)) {
    if (signalsFor(series, d).filter((s) => s.flagged).length >= 2) consecutiveDays++;
    else break;
  }
  const level = levelOf(flaggedCount, consecutiveDays);
  const reasons = signals.filter((s) => s.flagged).map((s) => s.text!);
  return {
    day,
    level,
    flaggedCount,
    consecutiveDays,
    signals,
    headline: HEADLINE[level],
    advice:
      level === "none"
        ? ADVICE.none
        : `${reasons.join(", ")}${consecutiveDays >= 2 ? ` – seit ${consecutiveDays} Tagen` : ""}. ${ADVICE[level]}`,
    disclaimer: DISCLAIMER,
  };
}
