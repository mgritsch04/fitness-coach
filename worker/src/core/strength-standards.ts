// Kraft relativ zum Körpergewicht (#203): bestes geschätztes 1RM der letzten 90 Tage je Grundübung geteilt
// durch das Körpergewicht, ähnlich wie W/kg auf dem Rad. Einordnung in grobe Stufen als Orientierung
// (Faustwerte für trainierte Erwachsene, keine Norm). 1RM nach Epley, Schätzung.
import { addDays } from "./analysis";
import { estimate1RM, exerciseName, type StrengthSession } from "./strength";

export const STANDARD_LEVELS = ["Einstieg", "Grundlage", "Fortgeschritten", "Stark", "Sehr stark"] as const;
export type StandardLevel = (typeof STANDARD_LEVELS)[number];

/** Grenzen (1RM ÷ Körpergewicht) zwischen den Stufen; beim Klimmzug zählt Körpergewicht plus Zusatzgewicht. */
const LIMITS: Record<string, [number, number, number, number]> = {
  back_squat: [0.75, 1.25, 1.5, 2.0],
  deadlift: [1.0, 1.5, 2.0, 2.5],
  bench_press: [0.5, 0.75, 1.0, 1.5],
  overhead_press: [0.35, 0.55, 0.75, 1.0],
  pull_up: [1.0, 1.15, 1.35, 1.6],
};

export interface StrengthStandard {
  exercise: string;
  name: string;
  e1rmKg: number;
  /** 1RM ÷ Körpergewicht (beim Klimmzug inklusive Körpergewicht). */
  perKg: number;
  level: StandardLevel;
  /** Nächste Stufe und dafür nötiges 1RM (null auf der höchsten Stufe). */
  next: { level: StandardLevel; e1rmKg: number } | null;
  day: string;
}

export interface StrengthStandards {
  available: boolean;
  weightKg: number | null;
  exercises: StrengthStandard[];
  text: string;
  note: string;
}

const NOTE = "Grobe Richtwerte für trainierte Erwachsene, keine Norm. 1RM nach Epley aus deinen Sätzen geschätzt (letzte 90 Tage). Für Radfahrer zählt Kraft pro kg mehr als absolute Kraft.";
const r2 = (v: number) => Math.round(v * 100) / 100;

export function strengthStandards(sessions: StrengthSession[], weightKg: number | null, today: string): StrengthStandards {
  const kg = weightKg && weightKg > 30 ? weightKg : null;
  if (!kg) return { available: false, weightKg: null, exercises: [], note: NOTE, text: "Für Kraft pro kg fehlt dein Körpergewicht. Trag es ein (Waage in WHOOP oder log_weight), dann erscheint die Einordnung." };
  const from = addDays(today, -89);
  const best = new Map<string, { e1rm: number; day: string }>();
  for (const s of sessions) {
    if (s.day < from || s.day > today) continue;
    for (const x of s.sets) {
      if (!(x.exercise in LIMITS)) continue;
      // Klimmzug: Körpergewicht plus Zusatzgewicht bewegen.
      const e = x.exercise === "pull_up" ? (x.reps >= 1 && x.reps <= 12 ? Math.round((kg + Math.max(0, x.weightKg || 0)) * (x.reps === 1 ? 1 : 1 + x.reps / 30) * 10) / 10 : null) : estimate1RM(x.weightKg, x.reps);
      if (e != null && e > (best.get(x.exercise)?.e1rm ?? 0)) best.set(x.exercise, { e1rm: e, day: s.day });
    }
  }
  const exercises: StrengthStandard[] = Object.keys(LIMITS).flatMap((ex) => {
    const b = best.get(ex);
    if (!b) return [];
    const perKg = r2(b.e1rm / kg);
    const lim = LIMITS[ex];
    const i = lim.filter((l) => perKg >= l).length;
    return [{ exercise: ex, name: exerciseName(ex), e1rmKg: b.e1rm, perKg, level: STANDARD_LEVELS[i], next: i < lim.length ? { level: STANDARD_LEVELS[i + 1], e1rmKg: Math.ceil(lim[i] * kg) } : null, day: b.day }];
  });
  if (!exercises.length)
    return { available: false, weightKg: kg, exercises, note: NOTE, text: "Noch keine Kniebeuge, Kreuzheben, Bankdrücken, Schulterdrücken oder Klimmzüge in den letzten 90 Tagen gespeichert." };
  const fmt = (v: number) => String(v).replace(".", ",");
  return {
    available: true, weightKg: kg, exercises, note: NOTE,
    text: exercises.map((e) => `${e.name} ${fmt(e.perKg)} × Körpergewicht (${e.level})`).join(" · "),
  };
}
