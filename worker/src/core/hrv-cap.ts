// HRV-Trend (hrv-trend.ts, Analyse-Thread) in der Tagesempfehlung: Ermüdung oder Sättigung → höchstens
// locker, 7-Tage-Mittel unter dem Normalbereich → höchstens normal. Macht die Empfehlung nie härter.
// Trainingshinweis, keine Diagnose.
import type { CoachAdvice, Readiness } from "./coach";
import type { HrvPattern } from "./hrv-trend";

const LEVELS: Readiness[] = ["rest", "easy", "moderate", "hard"];
const CAP: Partial<Record<HrvPattern, Readiness>> = { fatigue: "easy", saturation: "easy", low: "moderate" };
const HEADLINE: Record<Readiness, string> = {
  rest: "Heute Ruhe oder nur lockere Bewegung",
  easy: "Locker trainieren",
  moderate: "Normales Training",
  hard: "Bereit für eine harte Einheit",
};
const SUGGESTION: Partial<Record<Readiness, string>> = {
  easy: "Locker in Zone 1–2, 30–60 Minuten; Intervalle und schwere Beine verschieben.",
  moderate: "Normales Training ohne harte Intervalle; Grundlage oder Technik.",
};

export interface HrvSignal { pattern: HrvPattern; label: string; advice: string }

export function applyHrvTrend(advice: CoachAdvice, t: HrvSignal | null): CoachAdvice {
  if (!t) return advice;
  const cap = CAP[t.pattern];
  if (!cap) {
    // Gute Lage nur als Begründung, ohne die Empfehlung zu ändern.
    if (t.pattern !== "high") return advice;
    return { ...advice, reasons: [...advice.reasons, { factor: "hrv_trend", effect: "up", text: `HRV-Trend: ${t.label}.` }] };
  }
  const out: CoachAdvice = { ...advice, reasons: [...advice.reasons, { factor: "hrv_trend", effect: "down", text: `HRV-Trend: ${t.label}. ${t.advice}` }] };
  if (LEVELS.indexOf(advice.readiness) > LEVELS.indexOf(cap)) {
    out.readiness = cap;
    out.headline = HEADLINE[cap];
    out.suggestion = SUGGESTION[cap] ?? advice.suggestion;
    out.score = Math.min(advice.score, cap === "easy" ? 50 : 70);
    if (advice.targetLoad) {
      const f = cap === "easy" ? 0.6 : 0.85;
      out.targetLoad = { min: Math.round(advice.targetLoad.min * f), max: Math.round(advice.targetLoad.max * f) };
    }
    out.warnings = [...advice.warnings, `HRV-Trend: ${t.label}.`];
  }
  return out;
}
