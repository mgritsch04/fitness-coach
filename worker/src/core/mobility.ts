// Mobility-Routine nach der Einheit (#223): kurze Routinen (5–10 min) je Einheitstyp, passend zu dem, was
// beim Radfahren oder Krafttraining fest wird (Hüftbeuger, Rücken, Beine, Schultern). Übungen mit Dauer für
// einen Timer. Faustregeln, keine Physiotherapie; bei Schmerzen abbrechen.
import { EXERCISES, type StrengthSession } from "./strength";
import type { PlannedSession } from "./plan";

export type MobilityKind = "ride_long" | "ride_intervals" | "legs" | "upper" | "general";

export interface MobilityExercise {
  name: string;
  /** Dauer je Seite bzw. gesamt in Sekunden. */
  seconds: number;
  /** true = beide Seiten nacheinander (Dauer gilt je Seite). */
  sides: boolean;
  cue: string;
}

export interface MobilityRoutine {
  kind: MobilityKind;
  title: string;
  minutes: number;
  exercises: MobilityExercise[];
  note: string;
}

export const MOBILITY_NOTE = "Ruhig atmen, nur leichter Zug, kein Schmerz. Faustregel-Routine, keine Physiotherapie.";
const X = (name: string, seconds: number, sides: boolean, cue: string): MobilityExercise => ({ name, seconds, sides, cue });

const ROUTINES: Record<MobilityKind, { title: string; exercises: MobilityExercise[] }> = {
  ride_long: { title: "Nach langer Fahrt: Hüfte und Rücken", exercises: [
    X("Hüftbeuger-Dehnung im Ausfallschritt", 45, true, "Becken nach vorn schieben, Po anspannen."),
    X("Taube (Pigeon)", 45, true, "Vorderes Bein quer, Oberkörper langsam absenken."),
    X("Oberschenkel vorn im Stand", 30, true, "Ferse zum Po, Knie zeigen nach unten."),
    X("Katze-Kuh", 45, false, "Langsam rund und hohl, mit dem Atem."),
    X("Kindhaltung mit langen Armen", 45, false, "Po zu den Fersen, Rücken lang."),
    X("Brustöffner am Türrahmen", 30, true, "Unterarm an den Rahmen, Brust nach vorn."),
  ] },
  ride_intervals: { title: "Nach Intervallen: Beine lockern", exercises: [
    X("Oberschenkel vorn im Stand", 30, true, "Ferse zum Po, Knie zeigen nach unten."),
    X("Beinrückseite im Stand", 30, true, "Ferse vor, Hüfte nach hinten, Rücken gerade."),
    X("Hüftbeuger-Dehnung im Ausfallschritt", 40, true, "Becken nach vorn schieben."),
    X("Wade an der Wand", 30, true, "Hintere Ferse am Boden."),
    X("Kindhaltung", 45, false, "Ruhig ausatmen, Puls kommt runter."),
  ] },
  legs: { title: "Nach Beintag: Hüfte, Beine, Rücken", exercises: [
    X("90/90-Hüftrotation", 45, false, "Knie im Sitzen langsam von Seite zu Seite."),
    X("Taube (Pigeon)", 45, true, "Gesäß dehnen, ruhig atmen."),
    X("Beinrückseite im Liegen mit Band", 40, true, "Bein gestreckt, Knie leicht locker."),
    X("Adduktoren im Froschsitz", 45, false, "Knie weit, Po langsam nach hinten."),
    X("Wade an der Wand", 30, true, "Hintere Ferse am Boden."),
    X("Katze-Kuh", 40, false, "Rücken mobilisieren."),
  ] },
  upper: { title: "Nach Oberkörper: Schultern und Brustwirbelsäule", exercises: [
    X("Brustöffner am Türrahmen", 30, true, "Unterarm an den Rahmen, Brust nach vorn."),
    X("Faden einfädeln (Thread the needle)", 30, true, "Im Vierfüßlerstand Arm unter dem Körper durch."),
    X("Lat-Dehnung an der Bank", 40, false, "Ellbogen auf die Bank, Brust sinkt."),
    X("Wandengel", 45, false, "Rücken an der Wand, Arme langsam hoch und runter."),
    X("Nacken seitlich", 20, true, "Ohr zur Schulter, Schultern tief."),
  ] },
  general: { title: "Kurze Mobility für den Tag", exercises: [
    X("Katze-Kuh", 45, false, "Langsam rund und hohl."),
    X("Hüftbeuger-Dehnung im Ausfallschritt", 40, true, "Becken nach vorn."),
    X("90/90-Hüftrotation", 40, false, "Knie langsam von Seite zu Seite."),
    X("Brustöffner am Türrahmen", 30, true, "Brust nach vorn."),
    X("Kindhaltung", 45, false, "Ruhig ausatmen."),
  ] },
};

export const MOBILITY_KINDS = Object.keys(ROUTINES) as MobilityKind[];

export function mobilityRoutine(kind: MobilityKind): MobilityRoutine {
  const r = ROUTINES[kind];
  const sec = r.exercises.reduce((a, e) => a + e.seconds * (e.sides ? 2 : 1) + 10, 0);
  return { kind, title: r.title, minutes: Math.max(5, Math.round(sec / 60)), exercises: r.exercises, note: MOBILITY_NOTE };
}

/** Passende Routine zur Planeinheit: Kraft-Beine vor Rad, sonst nach Radtyp; ohne Einheit allgemein. */
export function mobilityKindFor(s: Pick<PlannedSession, "type" | "durationMin" | "strength"> | null): MobilityKind {
  if (!s) return "general";
  const focus = s.strength?.focus ?? "";
  if (/^Beine|^Ganzkörper(?! leicht)/.test(focus)) return "legs";
  if (s.type === "long" || s.type === "race" || ((s.type === "endurance" || s.type === "tempo") && s.durationMin >= 90)) return "ride_long";
  if (s.type === "threshold" || s.type === "vo2max" || s.type === "tempo" || s.type === "opener") return "ride_intervals";
  if (/^Oberkörper/.test(focus)) return "upper";
  if (s.type === "endurance") return "ride_long";
  return "general";
}

const LEG_MUSCLES = new Set(["quads", "hamstrings", "glutes", "calves"]);
const RIDE = /cycl|bike|biking|spin|ride|radfahr/i;

/**
 * Routine nach dem, was heute wirklich trainiert wurde (#297): Beintag (aus den gespeicherten Sätzen) vor
 * langer Fahrt (ab 90 min) vor harter Fahrt (≥ 70 Belastung pro Stunde) vor Oberkörper. Ohne heutige
 * Einheit oder ohne erkennbaren Fokus gilt weiter der Plan.
 */
export function mobilityKindForActual(
  today: string,
  workouts: { day: string; sport: string | null; durationMin: number; load: number | null }[],
  sessions: StrengthSession[],
  planned: Pick<PlannedSession, "type" | "durationMin" | "strength"> | null,
): { kind: MobilityKind; basis: "actual" | "plan" } {
  const rides = workouts.filter((w) => w.day === today && RIDE.test(w.sport ?? "") && w.durationMin >= 15);
  const rideMin = rides.reduce((a, w) => a + w.durationMin, 0);
  const rideLoad = rides.reduce((a, w) => a + (w.load ?? 0), 0);
  let legs = 0, upper = 0;
  for (const s of sessions) {
    if (s.day !== today) continue;
    for (const t of s.sets) for (const m of EXERCISES[t.exercise]?.primary ?? []) {
      if (LEG_MUSCLES.has(m)) legs++;
      else if (m !== "core" && m !== "other") upper++;
    }
  }
  if (legs && legs >= upper) return { kind: "legs", basis: "actual" };
  if (rideMin >= 90) return { kind: "ride_long", basis: "actual" };
  if (rideMin && rideLoad / (rideMin / 60) >= 70) return { kind: "ride_intervals", basis: "actual" };
  if (upper) return { kind: "upper", basis: "actual" };
  if (rideMin >= 30) return { kind: "ride_long", basis: "actual" };
  return { kind: mobilityKindFor(planned), basis: "plan" };
}
