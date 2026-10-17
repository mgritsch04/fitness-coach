// Express-Krafteinheit (#281): eine Einheit auf 20, 30 oder 45 Minuten kürzen, statt sie ausfallen zu
// lassen. Reihenfolge: Hilfsübungen als Supersatz, kürzere Pausen bei Grundübungen, dann erst Isolation,
// dann Hilfsübungen kürzen/streichen, zuletzt Grundübungen auf 2–3 Sätze. Zeiten sind Schätzungen.
import { exercisePattern, type Pattern } from "./exercises";
import { exerciseKey, exerciseName } from "./strength";

export interface ExpressInput { name: string; sets: number; reps: number; weightKg?: number | null; unit?: "Wdh" | "s" | null }

export interface ExpressExercise {
  exercise: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number | null;
  unit: "Wdh" | "s";
  /** Pause nach jedem Satz in Sekunden (im Supersatz nach jeder Übung) */
  restS: number;
  /** Supersatz-Gruppe A, B, … (abwechselnd mit der anderen Übung der Gruppe) */
  superset: string | null;
  priority: 1 | 2 | 3;
}

export interface StrengthExpress {
  minutes: number;
  fullMin: number;
  estimatedMin: number;
  fits: boolean;
  exercises: ExpressExercise[];
  dropped: string[];
  changes: string[];
  text: string;
  note: string;
}

const COMPOUND = new Set(["back_squat", "front_squat", "deadlift", "romanian_deadlift", "bench_press", "overhead_press", "pull_up", "barbell_row", "hip_thrust", "leg_press"]);
const ISOLATION_PATTERNS: Pattern[] = ["arms", "core", "calves", "knee_flexion"];
const ISOLATION = new Set(["lateral_raise", "face_pull", "chest_fly", "leg_extension"]);
const WARMUP_S = 300, CHANGE_S = 60, SUPERSET_REST_S = 60;
const FAMILY: Partial<Record<Pattern, "push" | "pull" | "legs">> = {
  push_horizontal: "push", push_vertical: "push", pull_vertical: "pull", pull_horizontal: "pull", squat: "legs", hinge: "legs", knee_flexion: "legs", calves: "legs",
};

export function priorityOf(key: string): 1 | 2 | 3 {
  if (COMPOUND.has(key)) return 1;
  const p = exercisePattern(key);
  return ISOLATION.has(key) || (p && ISOLATION_PATTERNS.includes(p)) ? 3 : 2;
}

const workS = (x: ExpressExercise) => (x.unit === "s" ? x.reps : Math.max(20, x.reps * 4));

/** Supersätze aus Hilfs- und Isolationsübungen: bevorzugt Drücken mit Ziehen, sonst zwei verschiedene Muster. */
function pair(list: ExpressExercise[]) {
  for (const x of list) x.superset = null;
  const open = list.filter((x) => x.priority > 1);
  const fam = (x: ExpressExercise) => FAMILY[exercisePattern(x.exercise) ?? "core"] ?? "other";
  let g = 0;
  for (const x of open) {
    if (x.superset) continue;
    const rest = open.filter((y) => y !== x && !y.superset);
    const partner =
      rest.find((y) => (fam(x) === "push" && fam(y) === "pull") || (fam(x) === "pull" && fam(y) === "push")) ??
      rest.find((y) => fam(y) !== fam(x)) ?? rest[0];
    if (!partner) break;
    x.superset = partner.superset = String.fromCharCode(65 + g++);
  }
}

export function estimateMin(list: ExpressExercise[]): number {
  let s = list.some((x) => x.priority === 1 && (x.weightKg ?? 0) > 0) ? WARMUP_S : 0;
  for (const x of list) s += CHANGE_S + x.sets * (workS(x) + x.restS);
  return Math.round(s / 60);
}

export function strengthExpress(input: ExpressInput[], minutes: number): StrengthExpress {
  const full: ExpressExercise[] = input.map((x) => {
    const { key } = exerciseKey(x.name);
    const priority = priorityOf(key);
    return {
      exercise: key, name: exerciseName(key, x.name), sets: x.sets, reps: x.reps, weightKg: x.weightKg ?? null,
      unit: x.unit === "s" ? "s" : "Wdh", restS: priority === 1 ? 180 : 90, superset: null, priority,
    };
  });
  const fullMin = estimateMin(full);
  let list = full.map((x) => ({ ...x }));
  const dropped: string[] = [], changes: string[] = [];
  const fits = () => estimateMin(list) <= minutes;
  const dropLast = (p: number) => {
    const i = list.map((x) => x.priority).lastIndexOf(p as 1 | 2 | 3);
    if (i < 0) return false;
    dropped.push(list[i].name);
    list.splice(i, 1);
    return true;
  };
  const cap = (p: number, max: number) => {
    let hit = false;
    for (const x of list) if (x.priority === p && x.sets > max) { x.sets = max; hit = true; }
    return hit;
  };
  const steps: (() => void)[] = [
    () => {
      for (const x of list) if (x.priority > 1) x.restS = SUPERSET_REST_S;
      pair(list);
      for (const x of list) if (x.priority > 1 && !x.superset) x.restS = 75;
      if (list.some((x) => x.superset)) changes.push("Hilfsübungen als Supersatz (abwechselnd, 60 s Pause)");
    },
    () => { if (list.some((x) => x.priority === 1)) { for (const x of list) if (x.priority === 1) x.restS = 120; changes.push("Pausen bei Grundübungen 2 min"); } },
    () => { if (cap(3, 2)) changes.push("Isolationsübungen 2 Sätze"); },
    () => { while (!fits() && dropLast(3)); },
    () => { if (cap(2, 2)) changes.push("Hilfsübungen 2 Sätze"); },
    () => { while (!fits() && dropLast(2)); },
    () => { if (cap(1, 3)) changes.push("Grundübungen 3 Sätze"); },
    () => { if (cap(1, 2)) changes.push("Grundübungen 2 Sätze"); },
    () => { while (!fits() && list.filter((x) => x.priority === 1).length > 2 && dropLast(1)); },
  ];
  for (const step of steps) {
    if (fits()) break;
    step();
    pair(list);
    for (const x of list) if (x.priority > 1 && changes.some((c) => c.startsWith("Hilfsübungen als Supersatz"))) x.restS = x.superset ? SUPERSET_REST_S : 75;
  }
  if (!changes.some((c) => c.startsWith("Hilfsübungen als Supersatz"))) for (const x of list) x.superset = null;
  // Nach dem Streichen kann ein Partner fehlen: ohne verbliebenen Supersatz auch keinen Hinweis darauf, normale Pause.
  else if (!list.some((x) => x.superset)) {
    changes.splice(changes.findIndex((c) => c.startsWith("Hilfsübungen als Supersatz")), 1);
    for (const x of list) if (x.priority > 1) x.restS = 75;
  }
  const est = estimateMin(list), ok = est <= minutes;
  // Nur Änderungen nennen, die im Ergebnis noch sichtbar sind.
  const has = (p: number) => list.some((x) => x.priority === p);
  const shown = changes.filter((c) =>
    (!c.startsWith("Isolation") || has(3)) && (!c.startsWith("Hilfsübungen") || has(2)) && !(c === "Grundübungen 3 Sätze" && changes.includes("Grundübungen 2 Sätze")));
  list = list.map((x) => ({ ...x }));
  const text = fullMin <= minutes
    ? `Die Einheit passt in ${minutes} min (geschätzt ${fullMin} min), nichts gekürzt.`
    : `Gekürzt von etwa ${fullMin} auf ${est} min: ${shown.join(", ") || "nur Übungen gestrichen"}.` +
      (dropped.length ? ` Weggelassen: ${dropped.join(", ")}. Diese Übungen bei der nächsten Einheit zuerst machen.` : "") +
      (ok ? "" : ` Auch gekürzt bleibt sie über ${minutes} min; dann lieber nur die Grundübungen.`);
  return {
    minutes, fullMin, estimatedMin: est, fits: ok, exercises: list, dropped, changes: shown, text,
    note: "Zeit geschätzt aus Sätzen, Pausen und 5 min Aufwärmen. Grundübungen haben Vorrang, Hilfsübungen werden zuerst gekürzt.",
  };
}
