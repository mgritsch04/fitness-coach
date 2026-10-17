// Wiederholungsrekorde je Gewicht (#299): „Erstmals 8 Wdh. mit 80 kg.“ Zeigt Fortschritt auch dann,
// wenn das geschätzte 1RM gleich bleibt. Je Übung die Bestmarken als Treppe: für jedes Gewicht die meisten
// Wiederholungen, die bei diesem oder einem schwereren Gewicht je geschafft wurden.
import { exerciseName, type StrengthSession } from "./strength";

export interface RepMark { kg: number; reps: number; day: string }
export interface RepRecords { exercise: string; name: string; marks: RepMark[] }

/** Bestmarken je Übung (Gewicht absteigend, Wdh. aufsteigend); Sätze ohne Gewicht zählen nicht. */
export function repRecords(sessions: StrengthSession[], today?: string): RepRecords[] {
  const by = new Map<string, Map<number, RepMark>>();
  for (const s of sessions) {
    if (today && s.day > today) continue;
    for (const t of s.sets) {
      if (!(t.weightKg > 0) || !(t.reps > 0)) continue;
      const m = by.get(t.exercise) ?? new Map<number, RepMark>();
      const cur = m.get(t.weightKg);
      if (!cur || t.reps > cur.reps || (t.reps === cur.reps && s.day < cur.day)) m.set(t.weightKg, { kg: t.weightKg, reps: t.reps, day: s.day });
      by.set(t.exercise, m);
    }
  }
  const out: RepRecords[] = [];
  for (const [exercise, m] of by) {
    // Nur Marken, die kein schwererer Satz mit mindestens so vielen Wdh. übertrifft.
    const marks: RepMark[] = [];
    for (const x of [...m.values()].sort((a, b) => b.kg - a.kg)) if (!marks.length || x.reps > marks.at(-1)!.reps) marks.push(x);
    out.push({ exercise, name: exerciseName(exercise), marks });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Bisher meiste Wdh. bei diesem oder höherem Gewicht; null, wenn noch nie so schwer. */
export function bestRepsAtLeast(marks: RepMark[], kg: number): number | null {
  let best: number | null = null;
  for (const m of marks) if (m.kg >= kg) best = Math.max(best ?? 0, m.reps);
  return best;
}

/** Rekord, wenn bei diesem (oder höherem) Gewicht schon gehoben wurde, aber noch nie so viele Wdh. */
export function repRecordFor(marks: RepMark[], kg: number, reps: number): { prev: number; text: string } | null {
  if (!(kg > 0) || !(reps > 0)) return null;
  const prev = bestRepsAtLeast(marks, kg);
  if (prev == null || reps <= prev) return null;
  return { prev, text: `Wiederholungsrekord: erstmals ${reps} Wdh. mit ${kg.toLocaleString("de-DE")} kg (bisher höchstens ${prev}).` };
}
