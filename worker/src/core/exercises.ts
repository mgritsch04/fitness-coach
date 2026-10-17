// Übung tauschen (#204): gleichwertige Alternativen je Übung (gleiche Muskelgruppe und ähnliches
// Bewegungsmuster), z. B. wenn im Studio das Gerät belegt ist. Startgewicht aus der eigenen Historie
// (letzter Top-Satz der Alternative), sonst selbst wählen. Faustregeln.
import { EXERCISES, exerciseKey, exerciseName, type StrengthSession } from "./strength";

export type Pattern = "squat" | "hinge" | "knee_flexion" | "push_horizontal" | "push_vertical" | "pull_vertical" | "pull_horizontal" | "arms" | "core" | "calves";

/** Bewegungsmuster und Alternativen in sinnvoller Reihenfolge (beste Ähnlichkeit zuerst). */
const LIBRARY: Record<string, { pattern: Pattern; alternatives: string[] }> = {
  back_squat: { pattern: "squat", alternatives: ["leg_press", "front_squat", "lunge"] },
  front_squat: { pattern: "squat", alternatives: ["back_squat", "leg_press", "lunge"] },
  leg_press: { pattern: "squat", alternatives: ["back_squat", "lunge", "leg_extension"] },
  lunge: { pattern: "squat", alternatives: ["leg_press", "front_squat", "back_squat"] },
  leg_extension: { pattern: "squat", alternatives: ["leg_press", "lunge"] },
  deadlift: { pattern: "hinge", alternatives: ["romanian_deadlift", "hip_thrust", "kettlebell_swing"] },
  romanian_deadlift: { pattern: "hinge", alternatives: ["deadlift", "hip_thrust", "leg_curl"] },
  hip_thrust: { pattern: "hinge", alternatives: ["romanian_deadlift", "kettlebell_swing", "lunge"] },
  kettlebell_swing: { pattern: "hinge", alternatives: ["romanian_deadlift", "hip_thrust"] },
  leg_curl: { pattern: "knee_flexion", alternatives: ["romanian_deadlift", "hip_thrust"] },
  bench_press: { pattern: "push_horizontal", alternatives: ["dumbbell_press", "incline_bench_press", "push_up", "dip"] },
  dumbbell_press: { pattern: "push_horizontal", alternatives: ["bench_press", "incline_bench_press", "push_up"] },
  incline_bench_press: { pattern: "push_horizontal", alternatives: ["dumbbell_press", "bench_press", "overhead_press"] },
  push_up: { pattern: "push_horizontal", alternatives: ["dumbbell_press", "bench_press", "dip"] },
  dip: { pattern: "push_horizontal", alternatives: ["push_up", "bench_press", "triceps_extension"] },
  chest_fly: { pattern: "push_horizontal", alternatives: ["dumbbell_press", "push_up"] },
  overhead_press: { pattern: "push_vertical", alternatives: ["incline_bench_press", "lateral_raise", "dumbbell_press"] },
  lateral_raise: { pattern: "push_vertical", alternatives: ["overhead_press", "face_pull"] },
  pull_up: { pattern: "pull_vertical", alternatives: ["lat_pulldown", "cable_row", "dumbbell_row"] },
  lat_pulldown: { pattern: "pull_vertical", alternatives: ["pull_up", "cable_row", "dumbbell_row"] },
  barbell_row: { pattern: "pull_horizontal", alternatives: ["dumbbell_row", "cable_row", "lat_pulldown"] },
  dumbbell_row: { pattern: "pull_horizontal", alternatives: ["cable_row", "barbell_row", "lat_pulldown"] },
  cable_row: { pattern: "pull_horizontal", alternatives: ["dumbbell_row", "barbell_row", "lat_pulldown"] },
  face_pull: { pattern: "pull_horizontal", alternatives: ["lateral_raise", "cable_row"] },
  biceps_curl: { pattern: "arms", alternatives: ["cable_row", "pull_up"] },
  triceps_extension: { pattern: "arms", alternatives: ["dip", "push_up"] },
  plank: { pattern: "core", alternatives: ["hanging_leg_raise", "crunch"] },
  crunch: { pattern: "core", alternatives: ["hanging_leg_raise", "plank"] },
  hanging_leg_raise: { pattern: "core", alternatives: ["crunch", "plank"] },
  calf_raise: { pattern: "calves", alternatives: ["leg_press"] },
};

export interface ExerciseAlternative {
  exercise: string;
  name: string;
  /** Startgewicht aus deiner letzten Einheit mit dieser Übung (null = selbst wählen). */
  startKg: number | null;
  lastDay: string | null;
  basis: "history" | "choose";
}

export interface ExerciseAlternatives {
  exercise: string;
  name: string;
  known: boolean;
  pattern: Pattern | null;
  alternatives: ExerciseAlternative[];
  note: string;
}

const NOTE = "Gleichwertige Übung für dieselbe Muskelgruppe. Startgewicht aus deiner letzten Einheit; ohne Vorwert so wählen, dass noch 2 Wiederholungen gehen würden.";

/** Letzter Top-Satz (schwerster Satz der jüngsten Einheit) einer Übung. */
function lastTop(sessions: StrengthSession[], key: string): { kg: number; day: string } | null {
  for (const s of [...sessions].sort((a, b) => b.day.localeCompare(a.day))) {
    const sets = s.sets.filter((x) => x.exercise === key && x.weightKg > 0);
    if (sets.length) return { kg: Math.max(...sets.map((x) => x.weightKg)), day: s.day };
  }
  return null;
}

/** Alternativen zu einer Übung (Katalog-Schlüssel oder Name, z. B. „Kniebeuge“). */
export function exerciseAlternatives(nameOrKey: string, sessions: StrengthSession[], exclude: string[] = []): ExerciseAlternatives {
  const { key, known } = exerciseKey(nameOrKey);
  const lib = LIBRARY[key];
  const skip = new Set([key, ...exclude.map((e) => exerciseKey(e).key)]);
  const keys = (lib?.alternatives ?? []).filter((k) => !skip.has(k) && EXERCISES[k]);
  return {
    exercise: key,
    name: exerciseName(key, nameOrKey),
    known,
    pattern: lib?.pattern ?? null,
    alternatives: keys.map((k) => {
      const t = lastTop(sessions, k);
      return { exercise: k, name: exerciseName(k), startKg: t?.kg ?? null, lastDay: t?.day ?? null, basis: t ? "history" : "choose" };
    }),
    note: NOTE,
  };
}

export const LIBRARY_KEYS = Object.keys(LIBRARY);

/** Bewegungsmuster einer Übung aus der Bibliothek (null = unbekannt). */
export const exercisePattern = (key: string): Pattern | null => LIBRARY[key]?.pattern ?? null;
