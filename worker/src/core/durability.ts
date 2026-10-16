// Ermüdungsresistenz (#139): beste 5- und 20-min-Leistung frisch und nach 500, 1000, 1500 kJ geleisteter Arbeit
// in derselben Fahrt, aus den Sekundenwerten der FIT-Dateien. Reine Funktionen; das Lesen steht unten.
import { addDays } from "./analysis";
import { readWorkoutStream } from "./repository";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

export const DURATIONS_S = [300, 1200] as const;
export const WORK_KJ = [0, 500, 1000, 1500] as const;

export interface RideStream {
  day: string;
  source: string;
  sourceId: string;
  /** Leistung je Sekunde (Lücken als null). */
  power: readonly (number | null)[];
}

/** Beste mittlere Leistung über `windowS` Sekunden, die frühestens bei Sekunde `fromS` beginnt. */
export function bestAfter(power: readonly (number | null)[], fromS: number, windowS: number): number | null {
  if (power.length - fromS < windowS) return null;
  let sum = 0;
  for (let i = fromS; i < fromS + windowS; i++) sum += power[i] ?? 0;
  let best = sum;
  for (let i = fromS + windowS; i < power.length; i++) {
    sum += (power[i] ?? 0) - (power[i - windowS] ?? 0);
    if (sum > best) best = sum;
  }
  return best / windowS;
}

/** Sekunde, ab der die geleistete Arbeit `kj` erreicht ist (null, wenn nie). */
export function secondAtWork(power: readonly (number | null)[], kj: number): number | null {
  if (kj <= 0) return 0;
  let j = 0;
  for (let i = 0; i < power.length; i++) {
    j += power[i] ?? 0;
    if (j >= kj * 1000) return i + 1;
  }
  return null;
}

export const totalKj = (power: readonly (number | null)[]) => power.reduce<number>((a, p) => a + (p ?? 0), 0) / 1000;

export function durabilityReport(rides: readonly RideStream[], today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const inRange = rides.filter((r) => r.day >= from && r.day <= today && r.power.some((p) => (p ?? 0) > 0));
  const table = DURATIONS_S.map((durationS) => {
    const levels = WORK_KJ.map((kj) => {
      let best: { watts: number; day: string } | null = null;
      let rideCount = 0;
      for (const r of inRange) {
        const at = secondAtWork(r.power, kj);
        if (at == null) continue;
        const w = bestAfter(r.power, at, durationS);
        if (w == null) continue;
        rideCount++;
        if (!best || w > best.watts) best = { watts: w, day: r.day };
      }
      return { kj, rides: rideCount, watts: round(best?.watts), day: best?.day ?? null };
    });
    const fresh = levels[0].watts;
    return {
      durationS,
      label: durationS === 300 ? "5 min" : "20 min",
      levels: levels.map((l) => ({ ...l, pctOfFresh: fresh && l.watts != null && l.kj > 0 ? round((l.watts / fresh) * 100, 1) : null })),
    };
  });

  // Einordnung über 5 min nach 1000 kJ (bzw. 500 kJ, wenn keine Fahrt so lang war).
  const five = table[0].levels;
  const ref = five.find((l) => l.kj === 1000 && l.pctOfFresh != null) ?? five.find((l) => l.kj === 500 && l.pctOfFresh != null) ?? null;
  const verdict =
    !inRange.length ? "Noch keine Fahrten mit Leistungsdaten (FIT-Upload) im Zeitraum."
    : !ref ? "Noch keine Fahrt mit mindestens 500 kJ Arbeit (etwa 1 h Grundlage) und einer harten Phase danach. Für eine Aussage eine längere Fahrt mit Intervallen am Ende hochladen."
    : ref.pctOfFresh! >= 95 ? `Sehr ermüdungsresistent: Nach ${ref.kj} kJ bringst du noch ${String(ref.pctOfFresh).replace(".", ",")} % deiner frischen 5-min-Leistung.`
    : ref.pctOfFresh! >= 88 ? `Solide: Nach ${ref.kj} kJ bringst du ${String(ref.pctOfFresh).replace(".", ",")} % deiner frischen 5-min-Leistung. Für lange Ausfahrten helfen Intervalle am Ende langer Grundlagenfahrten.`
    : `Ausbaufähig: Nach ${ref.kj} kJ bleiben ${String(ref.pctOfFresh).replace(".", ",")} % deiner frischen 5-min-Leistung. Mehr lange Grundlagenfahrten und harte Blöcke gegen Ende langer Einheiten verbessern das.`;
  return {
    today,
    range: { from, to: today, days },
    rides: inRange.length,
    longestRideKj: inRange.length ? Math.round(Math.max(...inRange.map((r) => totalKj(r.power)))) : null,
    table,
    verdict,
    notes: [
      "Beste Leistung über 5 bzw. 20 min, die erst beginnt, nachdem in derselben Fahrt 500, 1000 bzw. 1500 kJ geleistet sind (grob 1, 2 bzw. 3 h lockere Grundlage). Frisch = ohne Vorbelastung.",
      "Nur Fahrten mit Sekundenwerten (FIT-Upload). Werte nach Vorbelastung sind nur aussagekräftig, wenn du in dieser Phase auch wirklich hart gefahren bist. Schätzung, keine Diagnose.",
    ],
  };
}

// --- D1 ----------------------------------------------------------------------------------------

/** Fahrten mit Sekundenwerten im Zeitraum laden (höchstens `limit`, neueste zuerst). */
export async function readRideStreams(db: D1Database, fromDay: string, limit = 120): Promise<RideStream[]> {
  const { results } = await db
    .prepare(
      `SELECT w.day, w.source, w.source_id FROM workout_streams s JOIN workouts w ON w.source = s.source AND w.source_id = s.source_id
       WHERE w.day >= ? AND s.power IS NOT NULL ORDER BY w.start_time DESC LIMIT ?`,
    )
    .bind(fromDay, limit)
    .all<{ day: string; source: string; source_id: string }>();
  const out: RideStream[] = [];
  for (const r of results) {
    const s = await readWorkoutStream(db, r.source, r.source_id);
    if (Array.isArray(s?.power)) out.push({ day: r.day, source: r.source, sourceId: r.source_id, power: s!.power as (number | null)[] });
  }
  return out;
}
