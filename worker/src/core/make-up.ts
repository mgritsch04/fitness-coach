// Ausgefallene Schlüsseleinheit nachholen (#194): passenden Tag in der restlichen Woche suchen, an dem
// die Einheit eine lockere ersetzt. Abstände wie im Plan: kein harter Tag neben einem harten Tag, der
// langen Fahrt oder schweren Beinen. Passt nichts, wird nicht nachgeholt (nichts reinquetschen).
// Reine Funktion; Trainingsempfehlung nach Faustregeln, keine Diagnose.
import { addDays } from "./analysis";
import type { Readiness } from "./coach";
import { isHard, type ComparedDay, type PlanComparison, type SessionType } from "./plan";

export interface MakeUpPlan {
  missed: { day: string; title: string; type: SessionType };
  /** Vorgeschlagener Tag (null = nicht nachholen). */
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
const heavyLegs = (d: ComparedDay) => !!d.strength && /^Beine|^Ganzkörper(?! leicht)/.test(d.strength.focus);
const demanding = (d: ComparedDay | undefined) => !!d && (isHard(d.type) || d.type === "long" || heavyLegs(d));

const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const weekday = (day: string) => WD[new Date(`${day}T12:00:00Z`).getUTCDay()];

function missedKey(c: PlanComparison, today: string): ComparedDay[] {
  return c.days
    .filter((d) => d.key && d.day < today && (d.status === "missed" || (d.status === "partial" && isHard(d.type))))
    .sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type) || (a.day < b.day ? 1 : -1));
}

export function makeUpPlan(c: PlanComparison, today: string, readiness: Readiness | null): MakeUpPlan | null {
  const missed = missedKey(c, today);
  if (!missed.length) return null;
  const [m, ...rest] = missed;
  const byDay = new Map(c.days.map((d) => [d.day, d]));
  const candidates = c.days.filter((d) => {
    if (!EASY.includes(d.type) || d.day < today) return false;
    if (d.day === today && (d.status !== "today" || readiness === "rest" || readiness === "easy")) return false;
    if (heavyLegs(d)) return false;
    const prev = byDay.get(addDays(d.day, -1)), next = byDay.get(addDays(d.day, 1));
    // Vortag zählt auch, wenn er schon vorbei ist (z. B. gestern hart gefahren).
    const prevHard = prev && (prev.day < today ? ((isHard(prev.type) || prev.type === "long") && prev.status !== "missed") || (heavyLegs(prev) && !!prev.strengthDone) : demanding(prev));
    return !prevHard && !demanding(next);
  });
  const dropped = rest.map((r) => `${r.title} (${weekday(r.day)})`);
  const dropNote = dropped.length ? ` ${dropped.join(", ")} entfällt diese Woche ersatzlos.` : "";
  if (!candidates.length)
    return {
      missed: { day: m.day, title: m.title, type: m.type },
      day: null,
      replaces: null,
      dropped,
      text: `„${m.title}“ vom ${weekday(m.day)} nicht nachholen: Diese Woche bleibt kein Tag mit genug Abstand zu harten Einheiten. Normal weitermachen, das bringt mehr als zwei harte Tage hintereinander.${dropNote}`,
    };
  // Frühester passender Tag: mehr Puffer, falls noch etwas dazwischenkommt.
  const pick = candidates[0];
  return {
    missed: { day: m.day, title: m.title, type: m.type },
    day: pick.day,
    replaces: pick.title,
    dropped,
    text: `Nachholen: „${m.title}“ vom ${weekday(m.day)} ${pick.day === today ? "heute" : `am ${weekday(pick.day)}`} statt „${pick.title}“, mit Abstand zu den harten Tagen.${dropNote}`,
  };
}
