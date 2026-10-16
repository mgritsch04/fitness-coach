// Frühwarnung (warnings.ts, #24) in der Tagesempfehlung: caution → höchstens locker, alert → Ruhe.
// Macht die Empfehlung nie härter. Trainingshinweis, keine Diagnose.
import type { CoachAdvice, Readiness } from "./coach";
import type { EarlyWarning } from "./warnings";

const LEVELS: Readiness[] = ["rest", "easy", "moderate", "hard"];
const HEADLINE: Record<Readiness, string> = {
  rest: "Heute Ruhe oder nur lockere Bewegung",
  easy: "Locker trainieren",
  moderate: "Normales Training",
  hard: "Bereit für eine harte Einheit",
};

export function applyWarning(advice: CoachAdvice, w: Pick<EarlyWarning, "level" | "headline" | "advice">): CoachAdvice {
  if (w.level !== "caution" && w.level !== "alert") return advice;
  const cap: Readiness = w.level === "alert" ? "rest" : "easy";
  const out: CoachAdvice = { ...advice, reasons: [...advice.reasons, { factor: "warning", effect: "down", text: w.advice }], warnings: [...advice.warnings, `${w.headline}.`] };
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
