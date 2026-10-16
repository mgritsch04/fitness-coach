// Regelbasierte Tagesempfehlung aus Erholung, HRV-Trend, Schlaf und Trainingslast.
// Trainingsempfehlung, keine medizinische Diagnose. Die Schwellen sind gängige Faustregeln
// (WHOOP-Farben, TSB-Bereiche nach TrainingPeaks) und als Schätzung gekennzeichnet.
import { addDays, type DayPoint, type Trend } from "./analysis";

export type Readiness = "rest" | "easy" | "moderate" | "hard";

export interface Reason {
  /** Kurzer Schlüssel für die Oberfläche. */
  factor: "recovery" | "hrv" | "rhr" | "sleep" | "sleep_debt" | "form" | "ramp" | "monotony" | "data" | "strength";
  effect: "up" | "down" | "neutral";
  text: string;
}

export interface CoachAdvice {
  day: string;
  readiness: Readiness;
  /** 0–100, grobe Bereitschaft (Schätzung). */
  score: number;
  headline: string;
  suggestion: string;
  /** Vorschlag für die heutige Belastung im TSS-Maßstab (Schätzung). */
  targetLoad: { min: number; max: number } | null;
  reasons: Reason[];
  /** Warnungen, die über den Tag hinausgehen (z. B. zu schneller Anstieg der Trainingslast). */
  warnings: string[];
  disclaimer: string;
}

const LEVELS: Readiness[] = ["rest", "easy", "moderate", "hard"];

const HEADLINE: Record<Readiness, string> = {
  rest: "Heute Ruhe oder nur lockere Bewegung",
  easy: "Locker trainieren",
  moderate: "Normales Training",
  hard: "Bereit für eine harte Einheit",
};

const SUGGESTION: Record<Readiness, string> = {
  rest: "Spaziergang, Mobility oder ganz frei. Schlaf und Erholung haben heute Vorrang.",
  easy: "Grundlage (Zone 1–2), 30–60 Minuten, Puls unter der Schwelle halten.",
  moderate: "Ausdauer mit kurzen Tempoblöcken (Zone 3) oder normales Krafttraining.",
  hard: "Intervalle (Zone 4–5) oder ein längerer, fordernder Block – danach gut erholen.",
};

export function coachAdvice(series: DayPoint[], today: string, trends: { hrv: Trend; rhr: Trend; recovery: Trend; sleepH: Trend }, sleepNeedH: number): CoachAdvice {
  const reasons: Reason[] = [];
  const warnings: string[] = [];
  const byDay = new Map(series.map((p) => [p.day, p]));
  const t = byDay.get(today);
  const yesterday = byDay.get(addDays(today, -1));
  let score = 60;

  // Erholung (WHOOP): grün ≥ 67, gelb 34–66, rot < 34.
  const rec = t?.recovery ?? null;
  if (rec != null) {
    if (rec >= 67) {
      score += 20;
      reasons.push({ factor: "recovery", effect: "up", text: `Erholung ${Math.round(rec)} % (grün).` });
    } else if (rec >= 34) {
      score += (rec - 50) / 2;
      reasons.push({ factor: "recovery", effect: "neutral", text: `Erholung ${Math.round(rec)} % (gelb).` });
    } else {
      score -= 30;
      reasons.push({ factor: "recovery", effect: "down", text: `Erholung nur ${Math.round(rec)} % (rot).` });
    }
  } else {
    reasons.push({ factor: "data", effect: "neutral", text: "Für heute liegt noch keine Erholung vor (WHOOP wertet nach dem Aufwachen aus)." });
  }

  // HRV-Trend gegen die persönliche Basis.
  if (trends.hrv.status === "below") {
    score -= 10;
    reasons.push({ factor: "hrv", effect: "down", text: `HRV im 7-Tage-Mittel ${trends.hrv.deltaPct}% unter deiner Basis.` });
  } else if (trends.hrv.status === "above") {
    score += 5;
    reasons.push({ factor: "hrv", effect: "up", text: `HRV im 7-Tage-Mittel ${trends.hrv.deltaPct}% über deiner Basis.` });
  }

  // Ruhepuls deutlich erhöht: oft ein Zeichen für Ermüdung, Stress oder beginnenden Infekt.
  if (t?.rhr != null && trends.rhr.baseline != null && t.rhr >= trends.rhr.baseline + 5) {
    score -= 10;
    reasons.push({ factor: "rhr", effect: "down", text: `Ruhepuls ${t.rhr} liegt ${Math.round(t.rhr - trends.rhr.baseline)} Schläge über deiner Basis.` });
  }

  // Schlaf letzte Nacht und Schlafschuld der letzten 7 Nächte.
  if (t?.sleepH != null) {
    if (t.sleepH < 6) {
      score -= 10;
      reasons.push({ factor: "sleep", effect: "down", text: `Nur ${t.sleepH.toFixed(1)} h geschlafen.` });
    } else if (t.sleepH >= sleepNeedH - 0.25) {
      score += 5;
      reasons.push({ factor: "sleep", effect: "up", text: `${t.sleepH.toFixed(1)} h geschlafen.` });
    }
  }
  const last7 = series.filter((p) => p.day > addDays(today, -7) && p.day <= today && p.sleepH != null);
  const debt = last7.reduce((a, p) => a + (sleepNeedH - (p.sleepH ?? 0)), 0);
  if (last7.length >= 4 && debt > 5) {
    score -= 5;
    reasons.push({ factor: "sleep_debt", effect: "down", text: `Schlafschuld der letzten 7 Nächte etwa ${debt.toFixed(1)} h (Bedarf ${sleepNeedH} h).` });
  }

  // Form (TSB, Stand heute früh).
  const tsb = t?.tsb ?? yesterday?.tsb ?? null;
  const ctl = t?.ctl ?? 0;
  if (tsb != null && ctl >= 10) {
    if (tsb < -30) {
      score -= 15;
      reasons.push({ factor: "form", effect: "down", text: `Form ${Math.round(tsb)}: hohe Ermüdung aus den letzten Tagen.` });
    } else if (tsb < -10) {
      reasons.push({ factor: "form", effect: "neutral", text: `Form ${Math.round(tsb)}: produktiver Trainingsbereich.` });
    } else if (tsb > 15) {
      score += 5;
      reasons.push({ factor: "form", effect: "up", text: `Form +${Math.round(tsb)}: ausgeruht.` });
    }
  }

  // Anstieg der Fitness (CTL) über 7 Tage; mehr als ~8 Punkte pro Woche gilt als riskant.
  const weekAgo = byDay.get(addDays(today, -7));
  if (t && weekAgo && t.ctl - weekAgo.ctl > 8) {
    warnings.push(`Trainingslast steigt schnell (+${(t.ctl - weekAgo.ctl).toFixed(1)} Fitness-Punkte in 7 Tagen). Plane bald eine leichtere Woche ein.`);
  }

  // Monotonie: viele Tage hintereinander ohne Ruhetag.
  let streak = 0;
  for (let d = addDays(today, -1); byDay.get(d)?.workouts; d = addDays(d, -1)) streak++;
  if (streak >= 6) {
    score -= 5;
    reasons.push({ factor: "monotony", effect: "down", text: `${streak} Trainingstage in Folge ohne Ruhetag.` });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let readiness: Readiness = score < 35 ? "rest" : score < 55 ? "easy" : score < 75 ? "moderate" : "hard";
  // Rote Erholung erlaubt höchstens lockeres Training.
  if (rec != null && rec < 34 && LEVELS.indexOf(readiness) > 1) readiness = "easy";

  const factor: Record<Readiness, [number, number]> = { rest: [0, 0.3], easy: [0.4, 0.8], moderate: [0.8, 1.3], hard: [1.3, 2] };
  const base = Math.max(ctl, 30);
  const targetLoad = { min: Math.round(base * factor[readiness][0]), max: Math.round(base * factor[readiness][1]) };

  return {
    day: today,
    readiness,
    score,
    headline: HEADLINE[readiness],
    suggestion: SUGGESTION[readiness],
    targetLoad,
    reasons,
    warnings,
    disclaimer: "Trainingsempfehlung aus deinen Daten, keine medizinische Diagnose. Belastungswerte sind Schätzungen.",
  };
}
