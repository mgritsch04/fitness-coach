// Verpflegung je geplanter Einheit: vorher, währenddessen, danach. Faustregeln aus der Sporternährung
// (Kohlenhydrate je Stunde nach Dauer/Intensität, Eiweiß nach Kraft), keine Ernährungsberatung.
import { isHard, type PlannedSession } from "./plan";

export interface Fueling {
  day: string;
  /** Kurzfassung für Kacheln, z. B. „60–80 g KH/h, 0,6–0,8 l/h“. */
  short: string;
  before: string | null;
  during: string | null;
  after: string | null;
}

const round5 = (v: number) => Math.round(v / 5) * 5;

/**
 * Faustregeln:
 * - unter 60 min locker: nur Wasser; hart oder ab 60 min: 30–60 g Kohlenhydrate je Stunde; ab 90 min: 60–90 g/h.
 * - Trinken 0,5–0,8 l/h (auf der Rolle eher mehr), ab 90 min mit Salz.
 * - Nach harten oder langen Einheiten ~1 g/kg Kohlenhydrate plus ~0,3 g/kg Eiweiß; nach Kraft ~0,3 g/kg Eiweiß.
 */
export function fuelingFor(s: Pick<PlannedSession, "day" | "type" | "durationMin" | "strength">, weightKg: number | null): Fueling | null {
  if (s.type === "rest") return null;
  const kg = weightKg && weightKg > 30 ? weightKg : null;
  const protein = kg ? `${round5(kg * 0.3)} g Eiweiß` : "20–40 g Eiweiß";
  const strengthOnly = s.type === "strength";
  const min = strengthOnly ? 0 : s.durationMin;
  const hard = isHard(s.type) || s.type === "race";
  const strengthText = s.strength ? `Nach der Kraft: ${protein} (z. B. Quark, Skyr, Shake) innerhalb von 1–2 h.` : null;

  if (strengthOnly) {
    return { day: s.day, short: `danach ${protein}`, before: null, during: "Wasser reicht.", after: strengthText };
  }
  let during: string;
  let short: string;
  if (min >= 90) {
    during = `${min >= 150 ? "70–90" : "60–80"} g Kohlenhydrate pro Stunde (Riegel, Gel, Getränk; ab der ersten halben Stunde regelmäßig), 0,6–0,8 l pro Stunde trinken, auf der Rolle eher 0,8–1 l, mit etwas Salz.`;
    short = `${min >= 150 ? "70–90" : "60–80"} g KH/h · 0,6–1 l/h`;
  } else if (min >= 60 || hard) {
    during = "30–60 g Kohlenhydrate pro Stunde (z. B. Sportgetränk oder ein Riegel), 0,5–0,8 l pro Stunde trinken.";
    short = "30–60 g KH/h · 0,5–0,8 l/h";
  } else {
    during = "Wasser reicht.";
    short = "nur Wasser";
  }
  const before = min >= 90 || hard
    ? `2–3 h vorher kohlenhydratreich essen${kg ? ` (etwa ${round5(kg * 1.5)} g, z. B. Haferflocken, Reis, Brot)` : " (z. B. Haferflocken, Reis, Brot)"}; nicht nüchtern fahren.`
    : null;
  const after = min >= 90 || hard
    ? [`Danach innerhalb von 1–2 h: ${kg ? `${round5(kg * 1)} g Kohlenhydrate und ${protein}` : `Kohlenhydrate und ${protein}`}.`, s.strength ? "Die Eiweißportion deckt auch die Kraft ab." : null].filter(Boolean).join(" ")
    : strengthText;
  return { day: s.day, short, before, during, after };
}

export const FUELING_NOTE = "Verpflegung nach Faustregeln der Sporternährung, keine Ernährungsberatung. Mengen an Hunger, Verträglichkeit und Wetter anpassen.";
