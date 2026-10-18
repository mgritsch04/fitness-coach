// Übung frei beschreiben (#327): aus einer Beschreibung in eigenen Worten (Gerät, Bewegung, Zielmuskel)
// passende Übungen aus dem Katalog vorschlagen. Reine Stichwortsuche ohne KI, daher vorhersehbar und
// kostenlos; die Treffer sind Vorschläge, G wählt selbst.
import { EXERCISES, MUSCLE_LABEL, exerciseKey, type Muscle } from "./strength";

/** Stichwort-Anfänge je Übung: Gerät, Haltung, Bewegung (ohne Umlaute, siehe fold). */
const KEYWORDS: Record<string, string[]> = {
  back_squat: ["langhantel", "stange", "nacken", "schulter auf", "hocke", "hinsetz", "tief", "beugen", "aufsteh"],
  front_squat: ["vorne", "vor der brust", "schluesselbein", "hocke", "hinsetz", "front"],
  leg_press: ["maschine", "geraet", "schlitten", "platte", "druecken", "sitz", "liegend", "fuesse", "beine weg"],
  lunge: ["schritt", "ausfall", "einbein", "ein bein", "bank hinten", "hinteres bein", "knie zum boden", "split"],
  leg_extension: ["maschine", "geraet", "sitz", "strecken", "polster", "unterschenkel", "knie streck"],
  leg_curl: ["maschine", "geraet", "beugen", "polster", "ferse", "zum po", "liegend", "sitzend", "knie beug"],
  deadlift: ["langhantel", "stange", "boden", "vom boden", "heben", "aufricht", "hochzieh", "gerader ruecken"],
  romanian_deadlift: ["huefte nach hinten", "gestreckt", "steif", "knie leicht", "vorbeug", "dehnung hinten", "langhantel", "kurzhantel"],
  hip_thrust: ["bank", "schulter auf", "schultern auf", "huefte", "po hoch", "huefte hoch", "huefte nach oben", "becken", "bruecke", "rueckenlage"],
  kettlebell_swing: ["kettlebell", "kugel", "schwing", "schwung", "zwischen den beinen"],
  calf_raise: ["zehen", "zehenspitz", "ferse hoch", "stufe", "auf die spitzen"],
  bench_press: ["langhantel", "stange", "bank", "liegend", "flach", "druecken", "brust", "rueckenlage"],
  incline_bench_press: ["schraeg", "schrage", "bank", "liegend", "druecken", "obere brust", "steil"],
  dumbbell_press: ["kurzhantel", "hanteln", "bank", "liegend", "druecken"],
  chest_fly: ["fliegen", "arme auseinander", "zusammenfuehr", "umarm", "kabel", "seilzug", "butterfly", "maschine", "bogen"],
  dip: ["barren", "stuetz", "koerpergewicht", "absenk", "holme", "parallel"],
  push_up: ["boden", "koerpergewicht", "liegestuetz", "hoch druecken", "haende auf den boden", "ohne geraet"],
  overhead_press: ["ueber kopf", "ueber den kopf", "nach oben", "stehend", "sitzend", "druecken", "hoch druecken"],
  lateral_raise: ["seitlich", "zur seite", "seite heben", "arme heben", "kurzhantel", "seitheb"],
  face_pull: ["seil", "kabel", "seilzug", "zum gesicht", "kopfhoehe", "hintere schulter", "auseinander zieh"],
  pull_up: ["stange", "haengen", "haengend", "hochzieh", "kinn", "koerpergewicht", "klimmz"],
  lat_pulldown: ["kabel", "seilzug", "maschine", "von oben", "nach unten", "runter", "zur brust", "breit", "sitz", "lat"],
  barbell_row: ["langhantel", "stange", "vorgebeugt", "gebeugt", "zum bauch", "ziehen", "rudern"],
  dumbbell_row: ["kurzhantel", "einarmig", "ein arm", "bank", "knie auf", "ziehen", "rudern"],
  cable_row: ["kabel", "seilzug", "sitz", "sitzend", "maschine", "zum bauch", "ziehen", "rudern", "griff"],
  biceps_curl: ["beugen", "arm beug", "ellbogen beug", "kurzhantel", "langhantel", "sz", "hammer", "unterarm hoch"],
  triceps_extension: ["strecken", "arm streck", "ellbogen streck", "kabel", "seil", "nach unten druecken", "ueber kopf", "stirn"],
  plank: ["halten", "stuetz", "unterarm", "brett", "statisch", "gerade linie"],
  crunch: ["einrollen", "aufrichten", "oberkoerper hoch", "matte", "rueckenlage", "sit"],
  hanging_leg_raise: ["haengen", "haengend", "stange", "beine heben", "knie hoch", "knie zur brust"],
};

/** Muskeln in Alltagssprache. */
const MUSCLE_WORDS: Record<Muscle, string[]> = {
  chest: ["brust", "pecs"],
  back: ["ruecken", "lat", "latissimus", "oberer ruecken", "unterer ruecken"],
  shoulders: ["schulter", "delta"],
  biceps: ["bizeps", "oberarm vorne"],
  triceps: ["trizeps", "oberarm hinten"],
  quads: ["oberschenkel vorne", "quadrizeps", "beinstreck", "vorderer oberschenkel", "oberschenkel", "beine", "bein"],
  hamstrings: ["oberschenkel hinten", "beinbeuger", "hinterer oberschenkel", "hamstring", "beine", "bein"],
  glutes: ["po", "gesaess", "huefte", "glute", "hintern"],
  calves: ["wade"],
  core: ["bauch", "rumpf", "core", "sixpack"],
  other: [],
};

const fold = (s: string) =>
  ` ${s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim()} `;
/** Stichwort am Wortanfang (deckt Beugungen ab: „hängend“ → „haeng“). */
const has = (text: string, kw: string) => text.includes(` ${fold(kw).trim()}`);

export interface DescribeSuggestion {
  exercise: string;
  name: string;
  muscles: string[];
  /** Grob 0–100: wie gut die Beschreibung passt (relativ zum besten Treffer). */
  match: number;
  /** Gefundene Stichworte, damit der Vorschlag nachvollziehbar ist. */
  why: string[];
}

export interface DescribeResult {
  query: string;
  suggestions: DescribeSuggestion[];
  /** Vorschlag für eine eigene Übung, wenn nichts passt (oder zusätzlich zur Auswahl). */
  custom: { name: string };
  note: string;
}

const MIN_SCORE = 3;
/** Aliase wie „bauch“ sind zugleich Muskelwörter und zählen nicht als Namenstreffer. */
const MUSCLE_TERMS = new Set(Object.values(MUSCLE_WORDS).flat().map(fold));

export function describeExercise(text: string): DescribeResult {
  const t = fold(text);
  const scored = Object.entries(EXERCISES).map(([key, ex]) => {
    let score = 0;
    const why: string[] = [];
    // Name oder bekannter Alias steht in der Beschreibung: starker Treffer.
    for (const a of [ex.name, ...ex.aliases]) if (fold(a).trim().length >= 4 && !MUSCLE_TERMS.has(fold(a)) && t.includes(fold(a))) { score += 10; why.push(a); break; }
    for (const kw of KEYWORDS[key] ?? []) if (has(t, kw)) { score += kw.includes(" ") ? 3 : 2; why.push(kw); }
    for (const m of ex.primary) if (MUSCLE_WORDS[m].some((w) => has(t, w))) { score += 2; why.push(MUSCLE_LABEL[m]); }
    for (const m of ex.secondary ?? []) if (MUSCLE_WORDS[m].some((w) => has(t, w))) score += 0.5;
    return { key, ex, score, why: [...new Set(why)] };
  });
  const best = Math.max(0, ...scored.map((s) => s.score));
  const suggestions = scored
    .filter((s) => s.score >= MIN_SCORE && s.score >= best * 0.5)
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name))
    .slice(0, 3)
    .map((s) => ({
      exercise: s.key,
      name: s.ex.name,
      muscles: [...s.ex.primary, ...(s.ex.secondary ?? [])].map((m) => MUSCLE_LABEL[m]),
      match: Math.round((s.score / best) * 100),
      why: s.why.slice(0, 4),
    }));
  // Eigener Name: erste Wörter der Beschreibung, großer Anfangsbuchstabe; schon bekannte Namen bleiben.
  const words = text.trim().replace(/\s+/g, " ").split(" ").slice(0, 4).join(" ").slice(0, 40);
  const known = exerciseKey(words);
  const custom = { name: known.known ? EXERCISES[known.key].name : words ? words[0].toUpperCase() + words.slice(1) : "" };
  return {
    query: text,
    suggestions,
    custom,
    note: suggestions.length
      ? "Vorschläge aus dem Übungskatalog nach Stichworten (Gerät, Bewegung, Muskel). Passt keiner, als eigene Übung anlegen."
      : "Keine passende Übung im Katalog gefunden. Du kannst sie als eigene Übung anlegen.",
  };
}
