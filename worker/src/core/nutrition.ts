// Eiweiß- und Kohlenhydrat-Richtwert je Tag (#222): aus Körpergewicht und geplanter Einheit, ergänzt die
// Verpflegung je Einheit (fueling.ts). Faustregeln der Sporternährung (Eiweiß 1,6–2,0 g/kg; Kohlenhydrate
// je nach Belastung 3–10 g/kg). Allgemeiner Richtwert, keine Ernährungsberatung.
import type { Readiness } from "./coach";
import { isHard, type PlannedSession } from "./plan";

export type DayLevel = "rest" | "light" | "moderate" | "hard" | "very_hard";

export interface DailyNutrition {
  day: string;
  level: DayLevel;
  label: string;
  carbsPerKg: { min: number; max: number };
  proteinPerKg: { min: number; max: number };
  /** Gramm pro Tag (null ohne Körpergewicht). */
  carbsG: { min: number; max: number } | null;
  proteinG: { min: number; max: number } | null;
  short: string;
  text: string;
}

export const NUTRITION_NOTE = "Allgemeiner Richtwert nach Faustregeln der Sporternährung (Eiweiß 1,6–2,0 g/kg, Kohlenhydrate nach Belastung), keine Ernährungsberatung. Hunger und Gewichtsverlauf sind die bessere Rückmeldung.";

const CARBS: Record<DayLevel, [number, number]> = { rest: [3, 4], light: [4, 5], moderate: [5, 7], hard: [6, 8], very_hard: [8, 10] };
const LABEL: Record<DayLevel, string> = { rest: "Ruhetag", light: "lockerer Tag", moderate: "mittlerer Trainingstag", hard: "harter Tag", very_hard: "sehr langer Tag" };
const round5 = (v: number) => Math.round(v / 5) * 5;
const n = (v: number) => String(v).replace(".", ",");

/** Belastung des Tages aus der Planeinheit; heute zählt die Tagesform (Ruhe/locker senkt die Stufe). */
export function dayLevel(s: Pick<PlannedSession, "type" | "durationMin" | "strength">, readiness?: Readiness | null): DayLevel {
  let level: DayLevel;
  if (s.type === "rest") level = "rest";
  else if (s.type === "strength" || s.type === "recovery") level = "light";
  else if (s.type === "long" || s.type === "race") level = s.durationMin >= 150 ? "very_hard" : "hard";
  else if (isHard(s.type) && s.type !== "opener") level = s.durationMin >= 90 ? "very_hard" : "hard";
  else level = s.durationMin >= 90 ? "hard" : s.durationMin >= 45 ? "moderate" : "light";
  if (readiness === "rest") return "rest";
  if (readiness === "easy" && (level === "hard" || level === "very_hard" || level === "moderate")) return "light";
  return level;
}

export function dailyNutrition(s: Pick<PlannedSession, "day" | "type" | "durationMin" | "strength">, weightKg: number | null, readiness?: Readiness | null): DailyNutrition {
  const level = dayLevel(s, readiness);
  const [cMin, cMax] = CARBS[level];
  // Mehr Eiweiß an Krafttagen und Ruhetagen nach Kraft (Muskelaufbau), sonst Untergrenze.
  const pMin = 1.6, pMax = s.strength || s.type === "strength" ? 2.0 : 1.8;
  const kg = weightKg && weightKg > 30 ? weightKg : null;
  const carbsG = kg ? { min: round5(kg * cMin), max: round5(kg * cMax) } : null;
  const proteinG = kg ? { min: round5(kg * pMin), max: round5(kg * pMax) } : null;
  const short = carbsG && proteinG
    ? `KH ${carbsG.min}–${carbsG.max} g · Eiweiß ${proteinG.min}–${proteinG.max} g`
    : `KH ${cMin}–${cMax} g/kg · Eiweiß ${n(pMin)}–${n(pMax)} g/kg`;
  const meals = proteinG ? `, verteilt auf 4 Mahlzeiten je etwa ${round5(proteinG.min / 4)}–${round5(proteinG.max / 4)} g` : ", verteilt auf 3–4 Mahlzeiten";
  const text = `${LABEL[level][0].toUpperCase()}${LABEL[level].slice(1)}: ${carbsG ? `${carbsG.min}–${carbsG.max} g Kohlenhydrate (${cMin}–${cMax} g/kg)` : `${cMin}–${cMax} g Kohlenhydrate je kg`} und ${proteinG ? `${proteinG.min}–${proteinG.max} g Eiweiß` : `${n(pMin)}–${n(pMax)} g Eiweiß je kg`}${meals}.${level === "very_hard" || level === "hard" ? " Den Großteil der Kohlenhydrate vor, während und nach der Einheit." : ""}`;
  return { day: s.day, level, label: LABEL[level], carbsPerKg: { min: cMin, max: cMax }, proteinPerKg: { min: pMin, max: pMax }, carbsG, proteinG, short, text };
}
