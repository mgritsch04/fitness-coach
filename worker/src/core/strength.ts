// Krafttraining: Übungskatalog, Belastung (Session-RPE), Volumen je Muskelgruppe, geschätztes 1RM,
// Fortschritt je Übung und Hinweise für den Coach. Reine Funktionen oben, D1-Zugriffe unten.
// Alle 1RM- und Belastungswerte sind Schätzungen.
import { addDays, weekStart, type MergedWorkout, type WorkoutLoad } from "./analysis";
import { guessMuscles } from "./exercise-muscles";
import { applyOverrides, readOverrides, resolveKey } from "./exercise-manage";

// --- Übungskatalog -----------------------------------------------------------------------------

export type Muscle = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves" | "core" | "other";

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Brust",
  back: "Rücken",
  shoulders: "Schultern",
  biceps: "Bizeps",
  triceps: "Trizeps",
  quads: "Oberschenkel vorne",
  hamstrings: "Oberschenkel hinten",
  glutes: "Gesäß",
  calves: "Waden",
  core: "Rumpf",
  other: "Sonstige",
};

/** Muskelgruppen, die eine Radeinheit am Folgetag spürbar beeinträchtigen. */
export const LEG_MUSCLES: Muscle[] = ["quads", "hamstrings", "glutes"];

interface Exercise {
  name: string;
  primary: Muscle[];
  secondary?: Muscle[];
  aliases: string[];
}

export const EXERCISES: Record<string, Exercise> = {
  back_squat: { name: "Kniebeuge", primary: ["quads", "glutes"], secondary: ["hamstrings", "core"], aliases: ["squat", "kniebeuge", "kniebeugen", "back squat", "langhantel kniebeuge"] },
  front_squat: { name: "Frontkniebeuge", primary: ["quads"], secondary: ["glutes", "core"], aliases: ["front squat", "frontkniebeuge"] },
  leg_press: { name: "Beinpresse", primary: ["quads", "glutes"], secondary: ["hamstrings"], aliases: ["leg press", "beinpresse"] },
  lunge: { name: "Ausfallschritt", primary: ["quads", "glutes"], secondary: ["hamstrings"], aliases: ["lunge", "lunges", "ausfallschritt", "ausfallschritte", "split squat", "bulgarian split squat", "bulgarische kniebeuge"] },
  leg_extension: { name: "Beinstrecker", primary: ["quads"], aliases: ["leg extension", "beinstrecker"] },
  leg_curl: { name: "Beinbeuger", primary: ["hamstrings"], aliases: ["leg curl", "beinbeuger", "lying leg curl", "seated leg curl"] },
  deadlift: { name: "Kreuzheben", primary: ["hamstrings", "glutes", "back"], secondary: ["quads", "core"], aliases: ["deadlift", "kreuzheben", "conventional deadlift", "sumo deadlift"] },
  romanian_deadlift: { name: "Rumänisches Kreuzheben", primary: ["hamstrings", "glutes"], secondary: ["back"], aliases: ["rdl", "romanian deadlift", "rumänisches kreuzheben", "rumaenisches kreuzheben", "stiff leg deadlift"] },
  hip_thrust: { name: "Hip Thrust", primary: ["glutes"], secondary: ["hamstrings"], aliases: ["hip thrust", "hip thrusts", "glute bridge"] },
  calf_raise: { name: "Wadenheben", primary: ["calves"], aliases: ["calf raise", "calf raises", "wadenheben"] },
  bench_press: { name: "Bankdrücken", primary: ["chest"], secondary: ["triceps", "shoulders"], aliases: ["bench", "bench press", "bankdrücken", "bankdruecken", "flachbank"] },
  incline_bench_press: { name: "Schrägbankdrücken", primary: ["chest", "shoulders"], secondary: ["triceps"], aliases: ["incline bench", "incline bench press", "schrägbankdrücken", "schraegbankdruecken", "schrägbank"] },
  dumbbell_press: { name: "Kurzhantel-Bankdrücken", primary: ["chest"], secondary: ["triceps", "shoulders"], aliases: ["dumbbell press", "db press", "kurzhantel bankdrücken", "kurzhantel-bankdrücken"] },
  chest_fly: { name: "Fliegende", primary: ["chest"], aliases: ["fly", "flys", "chest fly", "fliegende", "butterfly", "cable fly"] },
  dip: { name: "Dips", primary: ["triceps", "chest"], secondary: ["shoulders"], aliases: ["dip", "dips"] },
  push_up: { name: "Liegestütz", primary: ["chest"], secondary: ["triceps", "shoulders", "core"], aliases: ["push up", "push-up", "pushups", "liegestütz", "liegestuetz", "liegestütze"] },
  overhead_press: { name: "Schulterdrücken", primary: ["shoulders"], secondary: ["triceps", "core"], aliases: ["ohp", "overhead press", "military press", "shoulder press", "schulterdrücken", "schulterdruecken"] },
  lateral_raise: { name: "Seitheben", primary: ["shoulders"], aliases: ["lateral raise", "lateral raises", "seitheben"] },
  face_pull: { name: "Face Pull", primary: ["shoulders", "back"], aliases: ["face pull", "face pulls"] },
  pull_up: { name: "Klimmzug", primary: ["back"], secondary: ["biceps"], aliases: ["pull up", "pull-up", "pullup", "pullups", "chin up", "chin-up", "klimmzug", "klimmzüge", "klimmzuege"] },
  lat_pulldown: { name: "Latziehen", primary: ["back"], secondary: ["biceps"], aliases: ["lat pulldown", "pulldown", "latziehen", "latzug"] },
  barbell_row: { name: "Langhantelrudern", primary: ["back"], secondary: ["biceps"], aliases: ["row", "barbell row", "bent over row", "rudern", "langhantelrudern", "vorgebeugtes rudern"] },
  dumbbell_row: { name: "Kurzhantelrudern", primary: ["back"], secondary: ["biceps"], aliases: ["dumbbell row", "db row", "kurzhantelrudern", "einarmiges rudern"] },
  cable_row: { name: "Rudern am Kabel", primary: ["back"], secondary: ["biceps"], aliases: ["cable row", "seated row", "seated cable row", "kabelrudern", "rudern am kabel", "rudermaschine"] },
  biceps_curl: { name: "Bizepscurl", primary: ["biceps"], aliases: ["curl", "curls", "biceps curl", "bicep curl", "bizepscurl", "bizeps curl", "hammer curl", "hammercurl"] },
  triceps_extension: { name: "Trizepsdrücken", primary: ["triceps"], aliases: ["triceps extension", "tricep extension", "pushdown", "triceps pushdown", "trizepsdrücken", "trizepsdruecken", "skull crusher", "french press"] },
  plank: { name: "Unterarmstütz", primary: ["core"], aliases: ["plank", "unterarmstütz", "unterarmstuetz"] },
  crunch: { name: "Crunch", primary: ["core"], aliases: ["crunch", "crunches", "sit up", "sit-up", "situps", "bauch"] },
  hanging_leg_raise: { name: "Beinheben hängend", primary: ["core"], aliases: ["hanging leg raise", "leg raise", "beinheben"] },
  kettlebell_swing: { name: "Kettlebell Swing", primary: ["glutes", "hamstrings"], secondary: ["core"], aliases: ["kettlebell swing", "kb swing", "swing", "swings"] },
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/[_\s-]+/g, " ");

const ALIAS_INDEX = new Map<string, string>();
for (const [key, ex] of Object.entries(EXERCISES)) {
  ALIAS_INDEX.set(normalize(key), key);
  ALIAS_INDEX.set(normalize(ex.name), key);
  for (const a of ex.aliases) ALIAS_INDEX.set(normalize(a), key);
}

/** Schlüssel einer Übung: Katalog-Schlüssel, sonst der normalisierte Name. */
export function exerciseKey(name: string): { key: string; known: boolean } {
  const n = normalize(name);
  const key = ALIAS_INDEX.get(n);
  return key ? { key, known: true } : { key: n, known: false };
}

/** Muskelgruppen: manuelle Zuordnung (Übungsverwaltung) vor Katalog, vor gespeicherten Gruppen, vor der Namens-Erkennung. */
export function musclesOf(key: string, custom?: Muscle[] | null, manual?: { primary: Muscle[]; secondary: Muscle[] } | null): { primary: Muscle[]; secondary: Muscle[] } {
  if (manual?.primary.length) return manual;
  const ex = EXERCISES[key];
  if (ex) return { primary: ex.primary, secondary: ex.secondary ?? [] };
  if (custom?.length) return { primary: custom, secondary: [] };
  return guessMuscles(key) ?? { primary: ["other"], secondary: [] };
}

/** Anzeigename; unbekannte Übungen, die nur noch als kleingeschriebener Schlüssel vorliegen, mit großem Anfangsbuchstaben. */
export const exerciseName = (key: string, fallback?: string) => {
  const name = EXERCISES[key]?.name ?? fallback ?? key;
  return name && name === name.toLowerCase() ? name[0].toUpperCase() + name.slice(1) : name;
};

// --- Datentypen ---------------------------------------------------------------------------------

export interface StrengthSet {
  exercise: string;
  exerciseName: string;
  reps: number;
  weightKg: number;
  rpe?: number | null;
  muscles?: Muscle[] | null;
  /** Manuelle Zuordnung aus der Übungsverwaltung (überstimmt Katalog und Erkennung). */
  muscleOverride?: { primary: Muscle[]; secondary: Muscle[] } | null;
}

export interface StrengthSession {
  id: string;
  day: string;
  startTime: string | null;
  durationMin: number | null;
  rpe: number | null;
  name: string | null;
  notes: string | null;
  linkedSource: string | null;
  linkedSourceId: string | null;
  /** Wiederholungen nicht verlässlich: Einheit zählt nicht für Bestwerte, Volumen und Belastung (Gewichte bleiben sichtbar). */
  repsUnreliable?: boolean;
  sets: StrengthSet[];
}

// --- 1RM und Volumen ----------------------------------------------------------------------------

/**
 * Geschätztes Ein-Wiederholungs-Maximum nach Epley: Gewicht · (1 + Wdh/30).
 * Über 12 Wiederholungen wird die Formel ungenau, solche Sätze liefern keine Schätzung.
 */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > 12) return null;
  return reps === 1 ? weightKg : Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface MuscleVolume {
  muscle: Muscle;
  label: string;
  /** Arbeitssätze: Hauptmuskel zählt ganz, Hilfsmuskel halb. */
  sets: number;
  /** Bewegte Last in kg (Gewicht · Wiederholungen), nur Hauptmuskel. */
  tonnageKg: number;
}

export function muscleVolume(sets: StrengthSet[]): MuscleVolume[] {
  const acc = new Map<Muscle, { sets: number; tonnageKg: number }>();
  const add = (m: Muscle, s: number, t: number) => {
    const e = acc.get(m) ?? { sets: 0, tonnageKg: 0 };
    e.sets += s;
    e.tonnageKg += t;
    acc.set(m, e);
  };
  for (const s of sets) {
    const { primary, secondary } = musclesOf(s.exercise, s.muscles, s.muscleOverride);
    for (const m of primary) add(m, 1, s.reps * s.weightKg);
    for (const m of secondary) add(m, 0.5, 0);
  }
  return [...acc.entries()]
    .map(([muscle, v]) => ({ muscle, label: MUSCLE_LABEL[muscle], sets: v.sets, tonnageKg: Math.round(v.tonnageKg) }))
    .sort((a, b) => b.sets - a.sets);
}

export interface WeeklyVolume {
  week: string;
  sessions: number;
  sets: number;
  tonnageKg: number;
  muscles: MuscleVolume[];
}

export function weeklyVolume(sessions: StrengthSession[]): WeeklyVolume[] {
  const byWeek = new Map<string, StrengthSession[]>();
  for (const s of sessions) {
    const w = weekStart(s.day);
    byWeek.set(w, [...(byWeek.get(w) ?? []), s]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, ss]) => {
      const sets = ss.flatMap((s) => s.sets);
      return { week, sessions: ss.length, sets: sets.length, tonnageKg: Math.round(sets.reduce((a, s) => a + s.reps * s.weightKg, 0)), muscles: muscleVolume(sets) };
    });
}

// --- Fortschritt je Übung -----------------------------------------------------------------------

export interface ExerciseProgress {
  exercise: string;
  name: string;
  sessions: number;
  /** Bestes geschätztes 1RM je Einheit, älteste zuerst. */
  history: { day: string; e1rmKg: number | null; topSet: { reps: number; weightKg: number }; sets: number }[];
  bestE1rmKg: number | null;
  bestDay: string | null;
  /** Veränderung des besten 1RM: letzte 4 Wochen gegen die 4 Wochen davor, in Prozent. */
  change4wPct: number | null;
  status: "progress" | "plateau" | "decline" | "new" | "unknown";
}

/** Plateau: mindestens 3 Einheiten in 6 Wochen, und die letzten drei bringen keine neue Bestmarke (mehr als 1 %). */
export function exerciseProgress(sessions: StrengthSession[], today: string): ExerciseProgress[] {
  const byExercise = new Map<string, { name: string; days: Map<string, StrengthSet[]> }>();
  for (const s of [...sessions].sort((a, b) => a.day.localeCompare(b.day))) {
    for (const set of s.sets) {
      const e = byExercise.get(set.exercise) ?? { name: exerciseName(set.exercise, set.exerciseName), days: new Map() };
      e.days.set(s.day, [...(e.days.get(s.day) ?? []), set]);
      byExercise.set(set.exercise, e);
    }
  }
  const out: ExerciseProgress[] = [];
  for (const [exercise, { name, days }] of byExercise) {
    const history = [...days.entries()].map(([day, sets]) => {
      const top = [...sets].sort((a, b) => (estimate1RM(b.weightKg, b.reps) ?? b.weightKg) - (estimate1RM(a.weightKg, a.reps) ?? a.weightKg) || b.reps - a.reps)[0];
      const e1rms = sets.map((s) => estimate1RM(s.weightKg, s.reps)).filter((x): x is number => x != null);
      return { day, e1rmKg: e1rms.length ? Math.max(...e1rms) : null, topSet: { reps: top.reps, weightKg: top.weightKg }, sets: sets.length };
    });
    const withE = history.filter((h) => h.e1rmKg != null);
    const best = withE.reduce<(typeof history)[number] | null>((b, h) => (b == null || h.e1rmKg! > b.e1rmKg! ? h : b), null);
    const maxIn = (from: string, to: string) => {
      const xs = withE.filter((h) => h.day >= from && h.day <= to).map((h) => h.e1rmKg!);
      return xs.length ? Math.max(...xs) : null;
    };
    const recent = maxIn(addDays(today, -27), today);
    const before = maxIn(addDays(today, -55), addDays(today, -28));
    const change4wPct = recent != null && before ? Math.round(((recent - before) / before) * 1000) / 10 : null;

    let status: ExerciseProgress["status"] = "unknown";
    const last6w = withE.filter((h) => h.day >= addDays(today, -41));
    if (withE.length === 1) status = "new";
    else if (change4wPct != null && change4wPct <= -5) status = "decline";
    else if (last6w.length >= 3) {
      // Die letzten drei Einheiten gegen die beste davor (ohne Vorgeschichte: gegen die erste der drei).
      const last3 = withE.slice(-3).map((h) => h.e1rmKg!);
      const prior = withE.slice(0, -3).map((h) => h.e1rmKg!);
      const priorBest = prior.length ? Math.max(...prior) : last3[0];
      const candidates = prior.length ? last3 : last3.slice(1);
      status = Math.max(...candidates) > priorBest * 1.01 ? "progress" : "plateau";
    } else if (change4wPct != null && change4wPct > 1) status = "progress";
    out.push({ exercise, name, sessions: history.length, history, bestE1rmKg: best?.e1rmKg ?? null, bestDay: best?.day ?? null, change4wPct, status });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

// --- Belastung ----------------------------------------------------------------------------------

/**
 * Belastung im TSS-Maßstab aus Dauer und Anstrengung (Session-RPE, Foster). Puls-basierte Werte
 * unterschätzen Krafttraining, weil die Belastung in kurzen Sätzen steckt. Punkte je Stunde nach
 * der gängigen RPE→TSS-Tabelle (RPE 7 ≈ 70/h, RPE 10 ≈ 120/h). Schätzung.
 */
const TSS_PER_HOUR_BY_RPE = [0, 20, 20, 30, 40, 50, 60, 70, 80, 100, 120];

export function srpeLoad(durationMin: number | null, rpe: number | null): number | null {
  if (!durationMin || durationMin <= 0 || rpe == null) return null;
  const r = Math.min(10, Math.max(1, rpe));
  const lo = Math.floor(r), hi = Math.ceil(r);
  const perHour = TSS_PER_HOUR_BY_RPE[lo] + (TSS_PER_HOUR_BY_RPE[hi] - TSS_PER_HOUR_BY_RPE[lo]) * (r - lo);
  return Math.round((durationMin / 60) * perHour * 10) / 10;
}

/** WHOOP- und andere Sportnamen, die als Krafttraining zählen. */
export const isStrengthSport = (sport: string | null | undefined) =>
  !!sport && /weight|power ?lift|bodybuild|strength|functional|cross ?fit|gym|kraft/i.test(sport.replace(/[-_]/g, " "));

/**
 * Sucht zur Einheit das passende Workout einer Quelle: zuerst die gespeicherte Verknüpfung, sonst
 * ein Kraft-Workout am selben Tag (bei bekannter Startzeit höchstens 90 Minuten daneben).
 */
export function findLinkedWorkout<W extends { source: string; source_id: string; day: string; start_time: string; sport: string | null }>(
  session: Pick<StrengthSession, "day" | "startTime" | "linkedSource" | "linkedSourceId">,
  workouts: W[],
): W | null {
  if (session.linkedSource && session.linkedSourceId) {
    const w = workouts.find((x) => x.source === session.linkedSource && x.source_id === session.linkedSourceId);
    if (w) return w;
  }
  const candidates = workouts.filter((w) => w.day === session.day && isStrengthSport(w.sport));
  if (!session.startTime) return candidates[0] ?? null;
  const t = Date.parse(session.startTime);
  const near = candidates
    .map((w) => ({ w, d: Math.abs(Date.parse(w.start_time) - t) }))
    .filter((x) => x.d <= 90 * 60_000)
    .sort((a, b) => a.d - b.d);
  return near[0]?.w ?? null;
}

type LoadedWorkout = MergedWorkout & WorkoutLoad;
/**
 * strengthRpe: Anstrengung der verknüpften Krafteinheit (strength_sessions.rpe).
 * strengthSessionId: verknüpfte Krafteinheit mit eingetragenen Sätzen (Vorlage aus der Workout-Übersicht, #331).
 */
export type StrengthLoadedWorkout = LoadedWorkout & { strengthRpe?: number | null; strengthSessionId?: string | null };

/**
 * Setzt für Krafteinheiten mit RPE die Belastung aus Session-RPE (statt Puls) und ergänzt
 * Einheiten ohne passendes Workout als eigene Einträge (Quelle „manual“). Liefert eine neue Liste.
 */
export function applyStrengthLoads(workouts: LoadedWorkout[], sessions: StrengthSession[]): StrengthLoadedWorkout[] {
  const out: StrengthLoadedWorkout[] = workouts.map((w) => ({ ...w }));
  for (const s of sessions) {
    const linked = findLinkedWorkout(s, out);
    const duration = s.durationMin ?? (linked?.duration_s != null ? linked.duration_s / 60 : null);
    const load = srpeLoad(duration, s.rpe);
    if (linked) {
      // Anstrengung aus dem Gym-Modus gilt auch für das verknüpfte Workout (#320).
      if (s.rpe != null && linked.strengthRpe == null) linked.strengthRpe = s.rpe;
      if (s.sets.length && !linked.strengthSessionId) linked.strengthSessionId = s.id;
      if (load != null && load > (linked.load ?? 0)) Object.assign(linked, { load, method: "srpe" as const, intensity: null });
      continue;
    }
    if (duration == null) continue;
    const start = s.startTime ?? `${s.day}T12:00:00.000Z`;
    out.push({
      day: s.day,
      source: "manual",
      source_id: s.id,
      start_time: start,
      end_time: new Date(Date.parse(start) + duration * 60_000).toISOString(),
      sport: "strength",
      duration_s: Math.round(duration * 60),
      distance_m: null,
      energy_kj: null,
      avg_hr: null,
      max_hr: null,
      avg_power_w: null,
      normalized_power_w: null,
      strain: null,
      sources: ["manual"],
      load,
      method: load != null ? "srpe" : "none",
      intensity: null,
      strengthRpe: s.rpe,
      strengthSessionId: s.sets.length ? s.id : null,
    });
  }
  return out.sort((a, b) => b.start_time.localeCompare(a.start_time));
}

// --- Coach-Hinweise -------------------------------------------------------------------------------

export interface StrengthNote {
  effect: "down" | "neutral";
  text: string;
}

/**
 * Kraft und Rad zusammen: Schwere Beineinheit gestern oder heute → keine harten Rad-Intervalle;
 * lange keine Kraft → Erinnerung. Trainingsempfehlung, keine Diagnose.
 */
export function strengthCoachNotes(sessions: StrengthSession[], today: string): StrengthNote[] {
  const notes: StrengthNote[] = [];
  const legSets = (s: StrengthSession) => muscleVolume(s.sets).filter((v) => LEG_MUSCLES.includes(v.muscle)).reduce((a, v) => a + v.sets, 0);
  const recent = sessions.filter((s) => s.day === today || s.day === addDays(today, -1));
  const heavy = recent.map((s) => ({ s, legs: legSets(s) })).filter((x) => x.legs >= 6 || (x.legs >= 3 && (x.s.rpe ?? 0) >= 8));
  if (heavy.length) {
    const h = heavy[0];
    const when = h.s.day === today ? "Heute" : "Gestern";
    notes.push({
      effect: "down",
      text: `${when} schwere Beine im Kraftraum (${Math.round(h.legs)} Beinsätze): harte Rad-Intervalle besser 48 h danach, heute höchstens locker kurbeln.`,
    });
  }
  const last = [...sessions].sort((a, b) => b.day.localeCompare(a.day))[0];
  if (last && last.day < addDays(today, -13)) {
    notes.push({ effect: "neutral", text: `Letzte Krafteinheit vor ${Math.round((Date.parse(today) - Date.parse(last.day)) / 86_400_000)} Tagen. Zwei kurze Einheiten pro Woche erhalten die Kraft auch in Radphasen.` });
  }
  return notes;
}

// --- Vorlagen --------------------------------------------------------------------------------------

export interface TemplateExercise {
  exercise: string;
  /** Anzeigename aus der Übungsverwaltung (wird nicht in der Vorlage gespeichert). */
  name?: string;
  sets: number;
  reps: number;
  weightKg?: number | null;
}

/**
 * Vorschlag für die nächste Einheit aus einer Vorlage: Sätze vom letzten Mal (lastSets) und Gewicht der letzten Einheit; wurden dort alle
 * Sätze mit der Ziel-Wiederholungszahl geschafft, +2,5 kg (Beine/Kreuzheben +5 kg). Schätzung.
 */
export function suggestFromTemplate(template: TemplateExercise[], sessions: StrengthSession[]) {
  const sorted = [...sessions].sort((a, b) => b.day.localeCompare(a.day));
  return template.map((t) => {
    const { key } = exerciseKey(t.exercise);
    const last = sorted.find((s) => s.sets.some((x) => x.exercise === key));
    const lastSets = last?.sets.filter((x) => x.exercise === key) ?? [];
    const lastWeight = lastSets.length ? Math.max(...lastSets.map((x) => x.weightKg)) : null;
    const allDone = lastSets.length >= t.sets && lastSets.filter((x) => x.weightKg === lastWeight).every((x) => x.reps >= t.reps);
    const step = ["back_squat", "front_squat", "deadlift", "romanian_deadlift", "leg_press", "hip_thrust"].includes(key) ? 5 : 2.5;
    const weightKg = lastWeight != null && lastWeight > 0 ? (allDone ? lastWeight + step : lastWeight) : (t.weightKg ?? 0);
    return {
      exercise: key,
      name: exerciseName(key, t.name ?? t.exercise),
      sets: t.sets,
      reps: t.reps,
      weightKg,
      basis: lastWeight == null ? "template" : allDone ? "increase" : "repeat",
      lastDay: last?.day ?? null,
      /** Sätze vom letzten Mal (#399): so oft und so schwer wie zuletzt, auch aus einer anderen Vorlage oder ohne Vorlage. */
      lastSets: lastSets.map((x) => ({ reps: x.reps, weightKg: x.weightKg })),
    };
  });
}

// --- D1 ------------------------------------------------------------------------------------------

interface SessionRow {
  id: string;
  day: string;
  start_time: string | null;
  duration_min: number | null;
  rpe: number | null;
  name: string | null;
  notes: string | null;
  linked_source: string | null;
  linked_source_id: string | null;
  reps_unreliable: number;
}

interface SetRow {
  session_id: string;
  idx: number;
  exercise: string;
  exercise_name: string;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  muscles: string | null;
}

/** Standard: ohne Einheiten mit unzuverlässigen Wiederholungen (Statistik); withUnreliable für die reine Auflistung. */
export async function readStrengthSessions(db: D1Database, fromDay: string, opts: { withUnreliable?: boolean; raw?: boolean } = {}): Promise<StrengthSession[]> {
  const only = opts.withUnreliable ? "" : " AND reps_unreliable = 0";
  const onlyX = opts.withUnreliable ? "" : " AND x.reps_unreliable = 0";
  const [{ results: sessions }, { results: sets }] = await Promise.all([
    db.prepare(`SELECT * FROM strength_sessions WHERE day >= ?${only} ORDER BY day DESC, start_time DESC`).bind(fromDay).all<SessionRow>(),
    db
      .prepare(`SELECT s.* FROM strength_sets s JOIN strength_sessions x ON x.id = s.session_id WHERE x.day >= ?${onlyX} ORDER BY s.session_id, s.idx`)
      .bind(fromDay)
      .all<SetRow>(),
  ]);
  const setsBySession = new Map<string, StrengthSet[]>();
  for (const r of sets) {
    const list = setsBySession.get(r.session_id) ?? [];
    list.push({ exercise: r.exercise, exerciseName: r.exercise_name, reps: r.reps, weightKg: r.weight_kg, rpe: r.rpe, muscles: r.muscles ? (JSON.parse(r.muscles) as Muscle[]) : null });
    setsBySession.set(r.session_id, list);
  }
  return applyOverrides(sessions.map((s) => ({
    id: s.id,
    day: s.day,
    startTime: s.start_time,
    durationMin: s.duration_min,
    rpe: s.rpe,
    name: s.name,
    notes: s.notes,
    linkedSource: s.linked_source,
    linkedSourceId: s.linked_source_id,
    ...(s.reps_unreliable ? { repsUnreliable: true } : {}),
    sets: setsBySession.get(s.id) ?? [],
  })), opts.raw ? new Map() : await readOverrides(db));
}

/** Legt eine Einheit an oder ersetzt sie (gleiche id) samt aller Sätze. */
export async function saveStrengthSession(db: D1Database, s: StrengthSession): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM strength_sets WHERE session_id = ?").bind(s.id),
    db
      .prepare(
        `INSERT INTO strength_sessions (id, day, start_time, duration_min, rpe, name, notes, linked_source, linked_source_id, reps_unreliable, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET day = excluded.day, start_time = excluded.start_time, duration_min = excluded.duration_min,
           rpe = COALESCE(excluded.rpe, strength_sessions.rpe), name = excluded.name, notes = excluded.notes, linked_source = excluded.linked_source,
           linked_source_id = excluded.linked_source_id, reps_unreliable = excluded.reps_unreliable, updated_at = excluded.updated_at`,
      )
      .bind(s.id, s.day, s.startTime, s.durationMin, s.rpe, s.name, s.notes, s.linkedSource, s.linkedSourceId, s.repsUnreliable ? 1 : 0),
    ...s.sets.map((x, i) =>
      db
        .prepare("INSERT INTO strength_sets (session_id, idx, exercise, exercise_name, reps, weight_kg, rpe, muscles) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(s.id, i, x.exercise, x.exerciseName, x.reps, x.weightKg, x.rpe ?? null, x.muscles?.length ? JSON.stringify(x.muscles) : null),
    ),
  ]);
}

export async function deleteStrengthSession(db: D1Database, id: string): Promise<boolean> {
  const row = await db.prepare("SELECT id FROM strength_sessions WHERE id = ?").bind(id).first();
  if (!row) return false;
  await db.batch([db.prepare("DELETE FROM strength_sets WHERE session_id = ?").bind(id), db.prepare("DELETE FROM strength_sessions WHERE id = ?").bind(id)]);
  return true;
}

export async function readTemplates(db: D1Database): Promise<{ name: string; exercises: TemplateExercise[] }[]> {
  const { results } = await db.prepare("SELECT name, exercises FROM strength_templates ORDER BY name").all<{ name: string; exercises: string }>();
  const map = await readOverrides(db);
  return results.map((r) => ({
    name: r.name,
    // Zusammengeführte Übungen zeigen auf die Zielübung (Name aus der Übungsverwaltung, falls vergeben).
    exercises: (JSON.parse(r.exercises) as TemplateExercise[]).map((e) => {
      const key = resolveKey(exerciseKey(e.exercise).key, map);
      return key === e.exercise && !map.get(key)?.displayName ? e : { ...e, exercise: key, name: map.get(key)?.displayName ?? undefined };
    }),
  }));
}

export async function saveTemplate(db: D1Database, name: string, exercises: TemplateExercise[]): Promise<void> {
  await db
    .prepare("INSERT INTO strength_templates (name, exercises, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (name) DO UPDATE SET exercises = excluded.exercises, updated_at = excluded.updated_at")
    .bind(name, JSON.stringify(exercises))
    .run();
}

export async function deleteTemplate(db: D1Database, name: string): Promise<boolean> {
  const row = await db.prepare("SELECT name FROM strength_templates WHERE name = ?").bind(name).first();
  if (!row) return false;
  await db.prepare("DELETE FROM strength_templates WHERE name = ?").bind(name).run();
  return true;
}

/** Entwurf der laufenden Gym-Einheit (nur einer; undurchsichtiges JSON des Browsers). */
export async function saveGymDraft(db: D1Database, data: string): Promise<string> {
  const at = new Date().toISOString();
  await db
    .prepare("INSERT INTO gym_draft (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
    .bind(data, at)
    .run();
  return at;
}

export async function readGymDraft(db: D1Database): Promise<{ data: string; updatedAt: string } | null> {
  const row = await db.prepare("SELECT data, updated_at FROM gym_draft WHERE id = 1").first<{ data: string; updated_at: string }>();
  return row ? { data: row.data, updatedAt: row.updated_at } : null;
}

export async function clearGymDraft(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM gym_draft WHERE id = 1").run();
}
