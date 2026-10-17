// Schlüsseleinheit nachholen (#194) oder verschieben (#198): passenden Tag in der restlichen Woche suchen,
// an dem die Einheit eine lockere ersetzt. Nachholen, wenn sie ausgefallen ist; verschieben, wenn sie heute
// geplant ist, die Tagesform aber „Ruhe“ oder „locker“ sagt. Abstände wie im Plan: kein harter Tag neben
// einem harten Tag, der langen Fahrt oder schweren Beinen. Passt nichts, lieber ausfallen lassen.
// Reine Funktion; Trainingsempfehlung nach Faustregeln, keine Diagnose.
import { addDays } from "./analysis";
import type { Readiness } from "./coach";
import { isHard, type ComparedDay, type PlanComparison, type PlannedSession, type SessionType } from "./plan";

export interface MakeUpPlan {
  /** makeUp = ausgefallen, nachholen; postpone = heute geplant, Tagesform zu schlecht, verschieben. */
  kind: "makeUp" | "postpone";
  missed: { day: string; title: string; type: SessionType };
  /** Vorgeschlagener Tag (null = nicht nachholen bzw. ausfallen lassen). */
  day: string | null;
  /** Titel der Einheit, die dafür entfällt. */
  replaces: string | null;
  text: string;
  /** Weitere ausgefallene Schlüsseleinheiten, die bewusst nicht nachgeholt werden. */
  dropped: string[];
}

/** Wichtigste zuerst: Schwelle und VO2max tragen die Woche, dann die lange Fahrt. */
const PRIORITY: SessionType[] = ["threshold", "vo2max", "long", "tempo", "race", "opener"];
const EASY: SessionType[] = ["recovery", "endurance"];
const heavyLegs = (d: PlannedSession) => !!d.strength && /^Beine|^Ganzkörper(?! leicht)/.test(d.strength.focus);
const demanding = (d: PlannedSession | undefined) => !!d && (isHard(d.type) || d.type === "long" || heavyLegs(d));
/** Lockere Ausdauer oder ein Krafttag ohne Beine kann Platz machen. */
const replaceable = (d: PlannedSession) => (EASY.includes(d.type) || d.type === "strength") && !heavyLegs(d);
const lowReadiness = (r: Readiness | null) => r === "rest" || r === "easy";

const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const weekday = (day: string) => WD[new Date(`${day}T12:00:00Z`).getUTCDay()];

function missedKey(c: PlanComparison, today: string): ComparedDay[] {
  return c.days
    .filter((d) => d.key && d.day < today && (d.status === "missed" || (d.status === "partial" && isHard(d.type))))
    .sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type) || (a.day < b.day ? 1 : -1));
}

/** @param nextWeekFirst erster Tag der nächsten Woche (für den Abstand am Sonntag). */
export function makeUpPlan(c: PlanComparison, today: string, readiness: Readiness | null, nextWeekFirst?: PlannedSession | null): MakeUpPlan | null {
  const missed = missedKey(c, today);
  const todayKey = c.days.find((d) => d.day === today && d.key && d.status === "today");
  // Heute ist wichtiger als Vergangenes: Wird die heutige Schlüsseleinheit verschoben, entfallen ausgefallene.
  const postpone = !!todayKey && lowReadiness(readiness);
  if (!missed.length && !postpone) return null;
  const [m, ...rest] = postpone ? [todayKey!, ...missed] : missed;
  const byDay = new Map<string, PlannedSession & Partial<ComparedDay>>(c.days.map((d) => [d.day, d]));
  if (nextWeekFirst) byDay.set(nextWeekFirst.day, nextWeekFirst);
  const candidates = c.days.filter((d) => {
    if (!replaceable(d) || d.day < today) return false;
    if (d.day === today && (postpone || d.status !== "today" || lowReadiness(readiness))) return false;
    const prev = byDay.get(addDays(d.day, -1)), next = byDay.get(addDays(d.day, 1));
    // Beim Verschieben ist heute ohnehin Ruhe; sonst zählt ein vergangener Vortag nur, wenn er auch gefahren wurde.
    const prevHard = prev && (postpone && prev.day === m.day ? false
      : prev.day < today ? ((isHard(prev.type) || prev.type === "long") && prev.status !== "missed") || (heavyLegs(prev) && !!prev.strengthDone)
      : demanding(prev));
    return !prevHard && !demanding(next);
  });
  const dropped = rest.map((r) => `${r.title} (${weekday(r.day)})`);
  const dropNote = dropped.length ? ` ${dropped.join(", ")} entfällt diese Woche ersatzlos.` : "";
  const base = { kind: postpone ? ("postpone" as const) : ("makeUp" as const), missed: { day: m.day, title: m.title, type: m.type }, dropped };
  if (!candidates.length)
    return {
      ...base,
      day: null,
      replaces: null,
      text: postpone
        ? `Heute lieber Ruhe: „${m.title}“ diese Woche ausfallen lassen, es bleibt kein Tag mit genug Abstand zu harten Einheiten oder Beinkraft. Eine Einheit weniger schadet weniger als Training gegen schlechte Werte.${dropNote}`
        : `„${m.title}“ vom ${weekday(m.day)} nicht nachholen: Diese Woche bleibt kein lockerer Tag mit genug Abstand zu harten Einheiten oder Beinkraft${lowReadiness(readiness) ? ", und heute passt die Tagesform nicht" : ""}. Normal weitermachen statt zwei harte Tage hintereinander.${dropNote}`,
    };
  // Frühester passender Tag: mehr Puffer, falls noch etwas dazwischenkommt.
  const pick = candidates[0];
  const when = pick.day === today ? "heute" : `am ${weekday(pick.day)}`;
  return {
    ...base,
    day: pick.day,
    replaces: pick.title,
    text: postpone
      ? `Heute lieber Ruhe: „${m.title}“ ${when} statt „${pick.title}“ fahren, wenn sich die Werte bis dahin erholt haben.${dropNote}`
      : `Nachholen: „${m.title}“ vom ${weekday(m.day)} ${when} statt „${pick.title}“, mit Abstand zu den harten Tagen.${dropNote}`,
  };
}
