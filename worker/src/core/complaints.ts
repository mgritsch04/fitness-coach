// Beschwerde-Karte (#376): Körperstellen im Check-in markieren; die Kraftvorschläge meiden dann Übungen,
// die diese Stelle belasten, und nehmen eine Alternative aus der Übungsbibliothek. Trainingsanpassung nach
// Faustregeln, keine Diagnose. Gespeichert wird als Tag im Tagebuch („beschwerde: knie“), keine eigene Tabelle.
import { addDays } from "./analysis";
import { exerciseAlternatives, LIBRARY_KEYS } from "./exercises";
import { EXERCISES, exerciseKey, exerciseName, type StrengthSession } from "./strength";
import type { JournalEntry } from "./journal";

export type Area = "shoulder" | "elbow" | "wrist" | "back" | "hip" | "knee" | "ankle";

export const AREA_LABEL: Record<Area, string> = { shoulder: "Schulter", elbow: "Ellbogen", wrist: "Handgelenk", back: "Rücken", hip: "Hüfte", knee: "Knie", ankle: "Sprunggelenk" };

export const COMPLAINT_PREFIX = "beschwerde: ";
export const areaTag = (a: Area) => `${COMPLAINT_PREFIX}${AREA_LABEL[a].toLowerCase()}`;
export const COMPLAINT_TAGS = (Object.keys(AREA_LABEL) as Area[]).map(areaTag);

/** Wie lange eine Markierung ohne neuen Check-in weiter gilt. */
export const COMPLAINT_DAYS = 21;

/** Welche Stellen eine Übung nach Faustregel belastet. Nicht aufgeführte Übungen gelten als unkritisch. */
const LOAD: Record<string, Area[]> = {
  back_squat: ["knee", "back", "hip"],
  front_squat: ["knee", "wrist", "hip"],
  leg_press: ["knee", "hip"],
  lunge: ["knee", "hip", "ankle"],
  leg_extension: ["knee"],
  leg_curl: ["knee"],
  deadlift: ["back", "hip"],
  romanian_deadlift: ["back", "hip"],
  hip_thrust: ["hip"],
  kettlebell_swing: ["back", "hip", "shoulder"],
  calf_raise: ["ankle"],
  bench_press: ["shoulder", "elbow", "wrist"],
  incline_bench_press: ["shoulder", "elbow", "wrist"],
  dumbbell_press: ["shoulder", "elbow"],
  chest_fly: ["shoulder"],
  dip: ["shoulder", "elbow", "wrist"],
  push_up: ["shoulder", "wrist", "elbow"],
  overhead_press: ["shoulder", "elbow", "back"],
  lateral_raise: ["shoulder"],
  face_pull: ["shoulder"],
  pull_up: ["shoulder", "elbow"],
  lat_pulldown: ["shoulder", "elbow"],
  barbell_row: ["back", "shoulder"],
  dumbbell_row: ["shoulder"],
  cable_row: ["shoulder"],
  biceps_curl: ["elbow", "wrist"],
  triceps_extension: ["elbow"],
  plank: ["shoulder", "wrist"],
  crunch: ["back"],
  hanging_leg_raise: ["shoulder", "back", "wrist"],
};

export const exerciseLoads = (key: string): Area[] => LOAD[key] ?? [];

/** Beschwerde-Stellen eines Check-ins (aus den Tags). */
export function complaintAreas(entry: Pick<JournalEntry, "tags"> | null | undefined): Area[] {
  const tags = new Set(entry?.tags ?? []);
  return (Object.keys(AREA_LABEL) as Area[]).filter((a) => tags.has(areaTag(a)));
}

/** Aktive Stellen: Stand des jüngsten Check-ins der letzten COMPLAINT_DAYS Tage. Ein neuer Check-in ohne Markierung hebt sie auf. */
export function activeComplaints(entries: JournalEntry[], today: string): Area[] {
  const latest = [...entries].filter((e) => e.day <= today && e.day >= addDays(today, -COMPLAINT_DAYS)).sort((a, b) => b.day.localeCompare(a.day))[0];
  return complaintAreas(latest);
}

export const COMPLAINT_NOTE = "Trainingsanpassung nach Faustregeln, keine Diagnose: Übungen, die die markierte Stelle belasten, werden getauscht oder ausgelassen. Die ursprüngliche Planung kommt zurück, sobald du die Markierung im Check-in entfernst. Bei anhaltenden oder starken Beschwerden ärztlich abklären lassen.";

export interface ComplaintAdjustment {
  /** Ersetzte oder entfernte Übung. */
  from: string;
  fromName: string;
  /** Alternative (null = ohne Ersatz ausgelassen). */
  to: string | null;
  toName: string | null;
  areas: Area[];
  text: string;
}

const list = (areas: Area[]) => areas.map((a) => AREA_LABEL[a]).join(", ");

/**
 * Tauscht Übungen, die eine markierte Stelle belasten, gegen die erste unkritische Alternative der
 * Bibliothek (keine Übung doppelt); gibt es keine, entfällt die Übung. Reihenfolge bleibt erhalten.
 */
export function adaptForComplaints<T extends { exercise: string }>(items: T[], areas: Area[], sessions: StrengthSession[]): { items: T[]; adjustments: ComplaintAdjustment[] } {
  if (!areas.length) return { items, adjustments: [] };
  const hit = (key: string) => exerciseLoads(key).filter((a) => areas.includes(a));
  const taken = new Set(items.map((i) => exerciseKey(i.exercise).key));
  const out: T[] = [];
  const adjustments: ComplaintAdjustment[] = [];
  for (const it of items) {
    const key = exerciseKey(it.exercise).key;
    const bad = hit(key);
    if (!bad.length) { out.push(it); continue; }
    const ok = (k: string) => !taken.has(k) && !hit(k).length;
    // Erst gleiches Bewegungsmuster, sonst eine unkritische Übung für dieselbe Hauptmuskelgruppe.
    const same = exerciseAlternatives(key, sessions).alternatives.find((a) => ok(a.exercise));
    const muscles = EXERCISES[key]?.primary ?? [];
    const other = same ? null : LIBRARY_KEYS.find((k) => ok(k) && EXERCISES[k]?.primary.some((m) => muscles.includes(m)));
    const alt = same ?? (other ? { exercise: other, name: exerciseName(other) } : null);
    const fromName = exerciseName(key, it.exercise);
    if (alt) {
      taken.add(alt.exercise);
      out.push({ ...it, exercise: alt.exercise, name: alt.name } as T);
      adjustments.push({ from: key, fromName, to: alt.exercise, toName: alt.name, areas: bad, text: `${fromName} → ${alt.name} (schont ${list(bad)})` });
    } else {
      adjustments.push({ from: key, fromName, to: null, toName: null, areas: bad, text: `${fromName} ausgelassen (belastet ${list(bad)})` });
    }
  }
  return { items: out, adjustments };
}
