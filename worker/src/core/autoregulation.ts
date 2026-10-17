// Autoregulation über die Reserve je Satz (#280): „Wie viele Wiederholungen wären noch drin?“ (RIR).
// Im Gym-Modus drei Stufen (0 / 1–2 / 3+), gespeichert als Satz-RPE (RPE = 10 − RIR). Daraus ein
// Vorschlag fürs nächste Gewicht und über mehrere Einheiten ein Hinweis je Übung. Faustregeln.
import { addDays } from "./analysis";
import { exerciseName, type StrengthSession } from "./strength";

export type RirLevel = "0" | "1-2" | "3+";
/** Satz-RPE je Reserve-Stufe (Mitte der Spanne). */
export const RIR_RPE: Record<RirLevel, number> = { "0": 10, "1-2": 8.5, "3+": 7 };
/** Zielreserve: 1–2 Wiederholungen. */
export const TARGET_RIR = 1.5;

/** Gewicht des nächsten Satzes: am Limit −5 %, Ziel getroffen gleich, zu leicht +2,5 %; Langhantel auf 2,5 kg, sonst auf 1 kg gerundet. */
export function nextSetWeight(kg: number, rir: RirLevel, opts: { bar?: boolean } = {}): number {
  if (!(kg > 0)) return kg;
  const step = opts.bar ? 2.5 : 1;
  const raw = rir === "0" ? kg * 0.95 : rir === "3+" ? kg * 1.025 : kg;
  let next = Math.round(raw / step) * step;
  // Mindestens ein Schritt Änderung, wenn eine gewollt ist.
  if (rir === "3+" && next <= kg) next = kg + step;
  if (rir === "0" && next >= kg) next = Math.max(0, kg - step);
  return Math.round(next * 10) / 10;
}

export interface RirExercise {
  exercise: string;
  name: string;
  sessions: number;
  /** mittlere Reserve (Wiederholungen) */
  avgRir: number;
  verdict: "up" | "hold" | "down";
  text: string;
}

export interface RirTrend {
  exercises: RirExercise[];
  text: string;
  note: string;
}

/** Je Übung die mittlere Reserve der letzten 21 Tage (ab 2 Einheiten mit Angabe): ≥ 3 → steigern, ≤ 0,5 → halten oder leichter. */
export function rirTrend(sessions: StrengthSession[], today: string): RirTrend {
  const from = addDays(today, -21);
  const by = new Map<string, { days: Set<string>; rir: number[] }>();
  for (const s of sessions) {
    if (s.day < from || s.day > today) continue;
    for (const t of s.sets) {
      if (t.rpe == null) continue;
      const e = by.get(t.exercise) ?? { days: new Set(), rir: [] };
      e.days.add(s.day);
      e.rir.push(Math.max(0, 10 - t.rpe));
      by.set(t.exercise, e);
    }
  }
  const exercises: RirExercise[] = [];
  for (const [exercise, e] of by) {
    if (e.days.size < 2) continue;
    const avg = Math.round((e.rir.reduce((a, b) => a + b, 0) / e.rir.length) * 10) / 10;
    const name = exerciseName(exercise);
    const verdict = avg >= 3 ? "up" : avg <= 0.5 ? "down" : "hold";
    const text =
      verdict === "up" ? `${name}: im Schnitt noch ${avg.toLocaleString("de-DE")} Wdh. Reserve, das Gewicht darf steigen.`
      : verdict === "down" ? `${name}: fast jeder Satz am Limit. Gewicht halten oder etwas leichter, damit die Technik sauber bleibt.`
      : `${name}: Reserve passt (${avg.toLocaleString("de-DE")} Wdh.).`;
    exercises.push({ exercise, name, sessions: e.days.size, avgRir: avg, verdict, text });
  }
  exercises.sort((a, b) => (a.verdict === "hold" ? 1 : 0) - (b.verdict === "hold" ? 1 : 0) || b.sessions - a.sessions);
  const off = exercises.filter((x) => x.verdict !== "hold");
  return {
    exercises,
    text: !exercises.length ? "Noch keine Reserve-Angaben aus mindestens zwei Einheiten je Übung." : off.length ? off.map((x) => x.text).join(" ") : "Die Reserve passt bei allen Übungen mit Angabe.",
    note: "Reserve = Wiederholungen, die noch drin gewesen wären (Selbsteinschätzung). Ziel 1–2. Faustregel, keine Norm.",
  };
}
