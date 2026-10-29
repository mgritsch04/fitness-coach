// Übungsverwaltung (#399): Liste aller Übungen mit Verlauf, Umbenennen, Zusammenführen, Ausblenden,
// manuelle Muskelgruppen, Dubletten-Vorschläge und „wie letztes Mal“. Die Sätze selbst bleiben unverändert,
// die Zuordnung (Overrides) wird beim Lesen angewendet.
import { estimate1RM, EXERCISES, exerciseKey, exerciseName, musclesOf, type Muscle, type StrengthSession, type StrengthSet } from "./strength";

export interface ExerciseOverride {
  key: string;
  mergedInto: string | null;
  displayName: string | null;
  hidden: boolean;
  musclesPrimary: Muscle[] | null;
  musclesSecondary: Muscle[] | null;
}

export type OverrideMap = Map<string, ExerciseOverride>;

interface OverrideRow {
  key: string;
  merged_into: string | null;
  display_name: string | null;
  hidden: number;
  muscles_primary: string | null;
  muscles_secondary: string | null;
}

export async function readOverrides(db: D1Database): Promise<OverrideMap> {
  const { results } = await db.prepare("SELECT * FROM exercise_overrides").all<OverrideRow>();
  return new Map(
    results.map((r) => [
      r.key,
      {
        key: r.key,
        mergedInto: r.merged_into,
        displayName: r.display_name,
        hidden: !!r.hidden,
        musclesPrimary: r.muscles_primary ? (JSON.parse(r.muscles_primary) as Muscle[]) : null,
        musclesSecondary: r.muscles_secondary ? (JSON.parse(r.muscles_secondary) as Muscle[]) : null,
      },
    ]),
  );
}

export async function saveOverride(db: D1Database, o: ExerciseOverride): Promise<void> {
  await db
    .prepare(
      `INSERT INTO exercise_overrides (key, merged_into, display_name, hidden, muscles_primary, muscles_secondary, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (key) DO UPDATE SET merged_into = excluded.merged_into, display_name = excluded.display_name, hidden = excluded.hidden,
         muscles_primary = excluded.muscles_primary, muscles_secondary = excluded.muscles_secondary, updated_at = excluded.updated_at`,
    )
    .bind(o.key, o.mergedInto, o.displayName, o.hidden ? 1 : 0, o.musclesPrimary?.length ? JSON.stringify(o.musclesPrimary) : null, o.musclesPrimary?.length && o.musclesSecondary?.length ? JSON.stringify(o.musclesSecondary) : null)
    .run();
}

/** Schlüssel nach allen Zusammenführungen (kettenfest, bricht bei Zyklen ab). */
export function resolveKey(key: string, map: OverrideMap): string {
  let k = key;
  for (let i = 0; i < 20; i++) {
    const next = map.get(k)?.mergedInto;
    if (!next || next === k) return k;
    k = next;
  }
  return k;
}

/** Wendet Zusammenführung, Anzeigename und manuelle Muskelgruppen auf gelesene Einheiten an. */
export function applyOverrides(sessions: StrengthSession[], map: OverrideMap): StrengthSession[] {
  if (!map.size) return sessions;
  // Name der Zielübung: Anzeigename, sonst Name aus der jüngsten Einheit, die diesen Schlüssel selbst benutzt.
  const own = new Map<string, string>();
  for (const s of [...sessions].sort((a, b) => b.day.localeCompare(a.day))) for (const x of s.sets) if (!own.has(x.exercise)) own.set(x.exercise, x.exerciseName);
  return sessions.map((s) => ({
    ...s,
    sets: s.sets.map((x) => {
      const key = resolveKey(x.exercise, map), o = map.get(key);
      if (key === x.exercise && !o) return x;
      const name = o?.displayName ?? (key === x.exercise ? x.exerciseName : (own.get(key) ?? exerciseName(key)));
      const muscleOverride = o?.musclesPrimary?.length ? { primary: o.musclesPrimary, secondary: o.musclesSecondary ?? [] } : null;
      return { ...x, exercise: key, exerciseName: name, ...(muscleOverride ? { muscleOverride } : {}) };
    }),
  }));
}

export interface ManagedExercise {
  exercise: string;
  name: string;
  sessions: number;
  sets: number;
  lastDay: string | null;
  bestE1rmKg: number | null;
  hidden: boolean;
  /** Übungen, die hier aufgegangen sind (lassen sich wieder trennen). */
  mergedFrom: { exercise: string; name: string }[];
  muscles: { primary: Muscle[]; secondary: Muscle[]; source: "manual" | "catalog" | "auto" | "unknown" };
  /** Alle bisherigen Durchgänge, neueste zuerst. */
  history: { day: string; sets: { reps: number; weightKg: number }[] }[];
  /** Sätze vom letzten Mal (Reihenfolge wie erfasst). */
  last: { day: string; sets: { reps: number; weightKg: number }[] } | null;
}

export interface DuplicateGroup {
  reason: string;
  exercises: { exercise: string; name: string }[];
}

const GENERIC = new Set(["kurzhantel", "langhantel", "maschine", "kabel", "am", "mit", "und", "der", "die", "das", "low", "high", "hantel", "seil", "einarmig", "uebung", "schwarze", "gerade", "sitzend", "stehend", "liegend"]);
const fold = (s: string) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();
/** Wortstamm grob: Mehrzahl-s/-n/-e abschneiden. */
const stem = (w: string) => (w.length > 4 ? w.replace(/(en|n|s|e)$/, "") : w);
const tokens = (name: string) => fold(name).split(" ").filter((t) => t.length >= 4 && !GENERIC.has(t)).map(stem);

/** Dubletten-Kandidaten: gemeinsames aussagekräftiges Wort im Namen (z. B. „Bizeps“). Vorschläge, G entscheidet. */
export function duplicateCandidates(list: { exercise: string; name: string; hidden: boolean }[]): DuplicateGroup[] {
  const byToken = new Map<string, { exercise: string; name: string }[]>();
  for (const e of list.filter((x) => !x.hidden)) {
    for (const t of new Set(tokens(e.name))) byToken.set(t, [...(byToken.get(t) ?? []), { exercise: e.exercise, name: e.name }]);
  }
  const out: DuplicateGroup[] = [];
  const seen = new Set<string>();
  for (const [t, xs] of [...byToken].sort((a, b) => b[1].length - a[1].length)) {
    if (xs.length < 2) continue;
    const id = xs.map((x) => x.exercise).sort().join("|");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ reason: `Alle enthalten „${t}“`, exercises: xs });
  }
  return out;
}

/** Alle Übungen aus Einheiten (Overrides schon angewendet) und Vorlagen. */
export function manageExercises(rawSessions: StrengthSession[], templates: { exercises: { exercise: string }[] }[], map: OverrideMap): { exercises: ManagedExercise[]; duplicates: DuplicateGroup[] } {
  const sessions = applyOverrides(rawSessions, map);
  const rawNames = new Map<string, string>();
  for (const s of rawSessions) for (const x of s.sets) rawNames.set(x.exercise, x.exerciseName);
  const by = new Map<string, { name: string; days: Map<string, StrengthSet[]>; manual: StrengthSet["muscleOverride"]; custom: Muscle[] | null }>();
  for (const s of [...sessions].sort((a, b) => a.day.localeCompare(b.day))) {
    for (const x of s.sets) {
      const e = by.get(x.exercise) ?? { name: x.exerciseName, days: new Map(), manual: null, custom: null };
      e.name = x.exerciseName;
      e.manual = x.muscleOverride ?? e.manual;
      e.custom = x.muscles ?? e.custom;
      e.days.set(s.day, [...(e.days.get(s.day) ?? []), x]);
      by.set(x.exercise, e);
    }
  }
  for (const t of templates) for (const x of t.exercises) {
    const key = resolveKey(exerciseKey(x.exercise).key, map);
    if (!by.has(key)) by.set(key, { name: map.get(key)?.displayName ?? exerciseName(key), days: new Map(), manual: null, custom: null });
  }
  for (const [key, o] of map) if (!o.mergedInto && !by.has(key)) by.set(key, { name: o.displayName ?? exerciseName(key, rawNames.get(key)), days: new Map(), manual: null, custom: null });
  const exercises: ManagedExercise[] = [...by].map(([key, e]) => {
    const days = [...e.days.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const all = days.flatMap(([, s]) => s);
    const e1 = all.map((s) => estimate1RM(s.weightKg, s.reps) ?? 0);
    const lastDay = days.at(-1);
    const o = map.get(key);
    const m = musclesOf(key, e.custom, e.manual);
    const source: ManagedExercise["muscles"]["source"] = e.manual ? "manual" : EXERCISES[key] ? "catalog" : m.primary[0] === "other" ? "unknown" : "auto";
    return {
      exercise: key,
      name: e.name,
      sessions: days.length,
      sets: all.length,
      lastDay: lastDay?.[0] ?? null,
      bestE1rmKg: Math.max(0, ...e1) || null,
      hidden: !!o?.hidden,
      mergedFrom: [...map.values()].filter((x) => x.mergedInto && x.key !== key && resolveKey(x.key, map) === key).map((x) => ({ exercise: x.key, name: map.get(x.key)?.displayName ?? exerciseName(x.key, rawNames.get(x.key)) })),
      muscles: { ...m, source },
      history: days.map(([day, sets]) => ({ day, sets: sets.map((x) => ({ reps: x.reps, weightKg: x.weightKg })) })).reverse(),
      last: lastDay ? { day: lastDay[0], sets: lastDay[1].map((s) => ({ reps: s.reps, weightKg: s.weightKg })) } : null,
    };
  });
  exercises.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "de"));
  return { exercises, duplicates: duplicateCandidates(exercises) };
}
