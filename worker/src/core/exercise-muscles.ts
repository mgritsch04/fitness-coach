// Muskelgruppen für Übungen außerhalb des Katalogs automatisch aus dem Namen erraten (Stichwortregeln,
// deutsch und englisch). Die erste passende Regel gewinnt, daher stehen die spezifischen vorn.
// Faustregeln: G kann die Zuordnung je Übung in der Übungsverwaltung überschreiben.
import type { Muscle } from "./strength";

export interface MuscleGuess {
  primary: Muscle[];
  secondary: Muscle[];
}

const fold = (s: string) => ` ${s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim()} `;

/** [Stichwörter am Wortanfang, Hauptmuskeln, Hilfsmuskeln] */
const RULES: [string[], Muscle[], Muscle[]][] = [
  [["beinbeug", "leg curl", "hamstring", "oberschenkel hinten", "nordic"], ["hamstrings"], []],
  [["rumaen", "romanian", "rdl", "kreuzheb", "deadlift", "good morning"], ["hamstrings", "glutes", "back"], ["core"]],
  [["hip thrust", "glute", "gesaess", " po ", "abduktor", "adduktor"], ["glutes"], ["hamstrings"]],
  [["wade", "calf", "calves"], ["calves"], []],
  [["beinstreck", "leg extension", "quadrizeps", "quad", "oberschenkel vorne"], ["quads"], []],
  [["kniebeug", "squat", "beinpress", "leg press", "ausfall", "lunge", "hack", "step up", "stepup", "bein"], ["quads", "glutes"], ["hamstrings"]],
  [["trizeps", "triceps", "pushdown", "skull", "french", "dip", "kickback"], ["triceps"], []],
  [["bizeps", "biceps", "curl", "hammer", "scott", "preacher"], ["biceps"], []],
  [["face pull", "seitheb", "lateral", "frontheb", "schulter", "shoulder", "overhead", "military", "arnold", "delt", "reverse fly", "reverse flys", "schulterdr"], ["shoulders"], ["triceps"]],
  [["shrug", "trapez", "nacken"], ["back"], []],
  [["brust", "bank", "bench", "chest", "fliegend", "fly", "butterfly", "liegestuetz", "push up", "pushup", "pec", "cable cross"], ["chest"], ["triceps", "shoulders"]],
  [["klimm", "pull up", "pullup", "chin up", "latzug", "latzieh", "pulldown", "lat ", "rudern", "row", "ruecken", "back", "hyperext", "rueckenstreck"], ["back"], ["biceps"]],
  [["plank", "stuetz", "crunch", "sit up", "situp", "bauch", "core", "rumpf", "russian", "twist", "beinheb", "leg raise", "ab wheel", "ab roller"], ["core"], []],
];

/** Muskelgruppen für einen Übungsnamen; null, wenn nichts erkennbar ist. */
export function guessMuscles(name: string): MuscleGuess | null {
  const text = fold(name);
  for (const [kws, primary, secondary] of RULES) {
    if (kws.some((k) => text.includes(k.startsWith(" ") ? k : ` ${k}`) || (k.length > 4 && text.includes(k)))) return { primary, secondary };
  }
  return null;
}
