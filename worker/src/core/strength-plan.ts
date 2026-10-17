// Konkrete Krafteinheit zum Wochenplan: Übungen, Sätze, Wiederholungen und Gewicht je Fokus
// („Beine + Rumpf“, „Oberkörper (Zug)“ …). Gewichte aus den gespeicherten Einheiten (gleiche Regel wie
// Vorlagen: alle Sätze geschafft → etwas mehr), sonst „Gewicht mit 2 Wdh. Reserve wählen“. Schätzung.
import { suggestFromTemplate, type StrengthSession, type TemplateExercise } from "./strength";
import { seasonItems, seasonWeightFactor, type StrengthSeasonPhase } from "./strength-season";

export interface StrengthExercise {
  exercise: string;
  name: string;
  sets: number;
  reps: number;
  /** Wiederholungen oder Sekunden (Halteübungen). */
  unit: "Wdh" | "s";
  /** Vorschlag aus der letzten Einheit; null = noch kein Wert, selbst wählen. */
  weightKg: number | null;
  basis: "template" | "increase" | "repeat" | "light";
  lastDay: string | null;
}

export interface StrengthWorkout {
  day: string;
  focus: string;
  durationMin: number;
  exercises: StrengthExercise[];
  text: string;
  /** Saisonphase, nach der Sätze und Wiederholungen angepasst sind (#213). */
  season?: StrengthSeasonPhase | null;
}

type Item = TemplateExercise & { unit?: "s" };
const T = (exercise: string, sets: number, reps: number, unit?: "s"): Item => ({ exercise, sets, reps, unit });

/** Übungen je Fokus, wichtigste zuerst (bei wenig Zeit fallen die hinteren weg). */
const BY_FOCUS: { match: RegExp; items: Item[] }[] = [
  { match: /^Ganzkörper leicht/, items: [T("leg_press", 2, 10), T("dumbbell_press", 2, 10), T("cable_row", 2, 10), T("plank", 2, 40, "s")] },
  { match: /^Beine/, items: [T("back_squat", 4, 5), T("romanian_deadlift", 3, 6), T("lunge", 2, 8), T("calf_raise", 2, 12), T("plank", 3, 45, "s")] },
  { match: /^Ganzkörper/, items: [T("leg_press", 3, 10), T("dumbbell_press", 3, 10), T("lat_pulldown", 3, 10), T("hip_thrust", 3, 10), T("plank", 2, 45, "s")] },
  { match: /Zug/, items: [T("pull_up", 4, 6), T("cable_row", 3, 10), T("face_pull", 3, 15), T("biceps_curl", 3, 12), T("hanging_leg_raise", 2, 10)] },
  { match: /Druck/, items: [T("bench_press", 4, 6), T("overhead_press", 3, 8), T("incline_bench_press", 3, 10), T("triceps_extension", 3, 12), T("lateral_raise", 3, 15)] },
  { match: /^Oberkörper/, items: [T("bench_press", 3, 8), T("barbell_row", 3, 8), T("overhead_press", 3, 8), T("lat_pulldown", 3, 10), T("hanging_leg_raise", 3, 10)] },
  { match: /^Rumpf/, items: [T("plank", 3, 45, "s"), T("hanging_leg_raise", 3, 10), T("kettlebell_swing", 3, 15), T("face_pull", 2, 15)] },
];
const FALLBACK = BY_FOCUS[2].items;

/** Übungen nach verfügbarer Zeit: ≤ 30 min drei, ≤ 45 min vier, sonst alle. */
const countFor = (min: number) => (min <= 30 ? 3 : min <= 45 ? 4 : 5);
const round25 = (kg: number) => Math.round(kg / 2.5) * 2.5;

export function strengthWorkout(day: string, s: { durationMin: number; focus: string }, sessions: StrengthSession[], season?: StrengthSeasonPhase | null): StrengthWorkout {
  const light = /leicht/.test(s.focus);
  const base = (BY_FOCUS.find((f) => f.match.test(s.focus))?.items ?? FALLBACK).slice(0, countFor(s.durationMin));
  const items = season ? seasonItems(base, season) : base;
  const factor = season ? seasonWeightFactor(season) : 1;
  const sugg = suggestFromTemplate(items, sessions);
  const exercises: StrengthExercise[] = items.map((it, i) => {
    const g = sugg[i];
    const hold = it.unit === "s";
    const weight = hold || g.basis === "template" || !g.weightKg ? null : light ? round25(g.weightKg * 0.6) : factor !== 1 ? round25(g.weightKg * factor) : g.weightKg;
    return {
      exercise: g.exercise,
      name: g.name,
      sets: it.sets,
      reps: it.reps,
      unit: hold ? "s" : "Wdh",
      weightKg: weight,
      basis: hold ? "template" : light && weight != null ? "light" : (g.basis as StrengthExercise["basis"]),
      lastDay: g.lastDay,
    };
  });
  const lines = exercises.map((e) => `${e.name} ${e.sets} × ${e.reps}${e.unit === "s" ? " s" : ""}${e.weightKg != null ? ` mit ${String(e.weightKg).replace(".", ",")} kg${e.basis === "increase" ? " (+)" : ""}` : ""}`);
  const open = exercises.some((e) => e.weightKg == null && e.unit === "Wdh");
  const text = `${lines.join(" · ")}.${open ? " Ohne Vorwert: Gewicht so wählen, dass noch 2 Wiederholungen gehen würden." : ""}${light ? " Leicht: etwa 60 % der üblichen Gewichte, Fokus Technik." : ""}`;
  return { day, focus: s.focus, durationMin: s.durationMin, exercises, text, season: season ?? null };
}

export const STRENGTH_PLAN_NOTE = "Übungsvorschlag nach Faustregeln; Gewichte aus deinen gespeicherten Einheiten (alle Sätze geschafft → etwas mehr). Übungen gleichwertig tauschen ist in Ordnung. Bei Schmerzen abbrechen.";
