// Doppeltage (#298): Rad und Kraft am selben Tag. Was zuerst kommt, hängt vom Tagesziel ab: harte oder
// lange Radeinheit zuerst (frische Beine für die Schlüsseleinheit), schwerer Beintag vor lockerem Rad
// (Ausrollen hilft danach). Abstand: je härter beides, desto mehr Stunden dazwischen. Faustregeln.
import { isHard, type PlannedSession } from "./plan";

export interface SameDayAdvice {
  day: string;
  order: "ride_first" | "strength_first" | "any";
  /** empfohlener Mindestabstand in Stunden (0 = direkt nacheinander möglich) */
  gapH: number;
  /** beides schwer für die Beine: besser auf zwei Tage verteilen */
  conflict: boolean;
  text: string;
}

const LEGS = /^Beine|^Ganzkörper(?! leicht)/;
const RIDE_TYPES = new Set(["recovery", "endurance", "long", "tempo", "threshold", "vo2max", "opener", "race"]);

export function sameDayAdvice(s: Pick<PlannedSession, "day" | "type" | "durationMin" | "strength">): SameDayAdvice | null {
  if (!s.strength || !RIDE_TYPES.has(s.type)) return null;
  const legs = LEGS.test(s.strength.focus);
  const hard = isHard(s.type) || s.type === "race";
  const long = s.type === "long" || s.durationMin >= 120;
  const day = s.day;
  if (hard && legs)
    return { day, order: "ride_first", gapH: 6, conflict: true, text: "Harte Radeinheit und Beinkraft am selben Tag: Rad zuerst (frische Beine für die Intervalle), Kraft frühestens 6 h später. Besser die Beinkraft auf einen lockeren Tag schieben." };
  if (hard)
    return { day, order: "ride_first", gapH: 3, conflict: false, text: "Rad-Intervalle zuerst, Oberkörperkraft danach mit etwa 3 h Abstand oder am Abend." };
  if (long && legs)
    return { day, order: "ride_first", gapH: 6, conflict: true, text: "Lange Fahrt und Beinkraft: Fahrt zuerst, Kraft frühestens 6 h später und leichter. Besser Beine an einem anderen Tag." };
  if (legs)
    return { day, order: "strength_first", gapH: 0, conflict: false, text: "Beinkraft zuerst, danach locker radeln (Zone 1–2) – das Ausrollen hilft der Erholung. Umgekehrt wären die Beine für die Kraft schon müde." };
  if (long)
    return { day, order: "ride_first", gapH: 2, conflict: false, text: "Lange Fahrt zuerst, Oberkörperkraft danach mit 1–2 h Pause und etwas essen." };
  return { day, order: "any", gapH: 0, conflict: false, text: "Oberkörperkraft und lockeres Rad stören sich kaum. Reihenfolge nach Lust, direkt nacheinander geht." };
}
