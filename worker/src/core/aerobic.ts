// Aerobe Basis (#145): Pa:HR-Entkopplung gleichmäßiger Fahrten im Verlauf, aus den Sekundenwerten der FIT-Dateien.
// Je Fahrt ohne die ersten 10 min Aufwärmen. Reine Funktionen; das Lesen steht unten.
import { addDays } from "./analysis";
import { normalizedPower } from "./power";
import { readWorkoutStream } from "./repository";
import { decoupling } from "./workout-detail";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const median = (xs: readonly number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Aufwärmen, das nicht mitzählt. */
export const WARMUP_S = 600;
/** Mindestlänge der Fahrt (inklusive Aufwärmen). */
export const MIN_RIDE_S = 50 * 60;
/** Höchster Variabilitätsindex (NP / Ø-Leistung) für eine gleichmäßige Fahrt. */
export const MAX_VI = 1.1;
/** Fahrten je Vergleichsgruppe (aktuell gegen davor). */
export const GROUP = 4;

export interface HrRideStream {
  day: string;
  source: string;
  sourceId: string;
  power: readonly (number | null)[];
  heartRate: readonly (number | null)[];
}

export const decouplingBand = (pct: number) => (pct < 5 ? "good" : pct <= 8 ? "ok" : "high");

/** Kennzahlen einer Fahrt oder null, wenn sie zu kurz oder zu ungleichmäßig ist. */
export function steadyRide(r: HrRideStream) {
  if (r.power.length < MIN_RIDE_S || r.heartRate.length < MIN_RIDE_S) return { steady: false as const, reason: "short" as const };
  const power = r.power.slice(WARMUP_S), hr = r.heartRate.slice(WARMUP_S);
  const moving = power.filter((p): p is number => p != null && p > 0);
  if (moving.length < (MIN_RIDE_S - WARMUP_S) * 0.9) return { steady: false as const, reason: "short" as const };
  const avg = moving.reduce((a, b) => a + b, 0) / power.length;
  const np = normalizedPower([...power]);
  const vi = np && avg ? np / avg : null;
  if (vi == null || vi > MAX_VI) return { steady: false as const, reason: "variable" as const, vi: round(vi, 2) };
  const d = decoupling([...power], [...hr]);
  if (!d) return { steady: false as const, reason: "short" as const };
  return {
    steady: true as const,
    day: r.day, source: r.source, sourceId: r.sourceId,
    durationMin: Math.round(r.power.length / 60),
    avgPowerW: Math.round(avg),
    vi: round(vi, 2)!,
    decouplingPct: d.pct,
    band: decouplingBand(d.pct),
  };
}

export function aerobicReport(rides: readonly HrRideStream[], today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const inRange = rides.filter((r) => r.day >= from && r.day <= today);
  const checked = inRange.map(steadyRide);
  const steady = checked.flatMap((c) => (c.steady ? [c] : [])).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const skipped = { variable: checked.filter((c) => !c.steady && c.reason === "variable").length, short: checked.filter((c) => !c.steady && c.reason === "short").length };

  const recent = steady.slice(-GROUP), before = steady.slice(-2 * GROUP, -GROUP);
  const now = median(recent.map((r) => r.decouplingPct));
  const prev = before.length >= 2 ? median(before.map((r) => r.decouplingPct)) : null;
  const longestGood = steady.filter((r) => r.decouplingPct < 5).reduce<(typeof steady)[number] | null>((a, r) => (!a || r.durationMin > a.durationMin ? r : a), null);
  const fmt = (v: number) => String(round(v, 1)).replace(".", ",");

  const verdict =
    now == null ? "Noch keine gleichmäßige Fahrt ab 50 min mit Leistung und Puls (FIT-Upload) im Zeitraum. Eine ruhige Grundlagenfahrt mit konstanter Leistung liefert den ersten Wert."
    : now < 5 ? `Gute aerobe Basis: Deine Leistung je Herzschlag sinkt bei gleichmäßigen Fahrten im Mittel nur um ${fmt(now)} %.`
    : now <= 8 ? `Mittlere aerobe Basis: ${fmt(now)} % Entkopplung. Regelmäßige lange, lockere Fahrten (Zone 2) senken den Wert.`
    : `Die aerobe Basis lässt sich ausbauen: ${fmt(now)} % Entkopplung. Mehr lange, lockere Fahrten und ausreichend trinken helfen; Wärme auf der Rolle erhöht den Wert ebenfalls.`;
  const trend =
    now == null || prev == null ? null
    : now <= prev - 1 ? { direction: "better" as const, text: `Besser als zuvor (${fmt(prev)} % → ${fmt(now)} %).` }
    : now >= prev + 1 ? { direction: "worse" as const, text: `Schlechter als zuvor (${fmt(prev)} % → ${fmt(now)} %). Müdigkeit, Hitze oder wenig Grundlage können dahinterstecken.` }
    : { direction: "stable" as const, text: `Etwa gleich wie zuvor (${fmt(prev)} %).` };

  return {
    today,
    range: { from, to: today, days },
    rides: steady,
    skipped,
    current: { medianPct: round(now, 1), previousMedianPct: round(prev, 1), band: now == null ? null : decouplingBand(now) },
    trend,
    longestGood: longestGood ? { day: longestGood.day, durationMin: longestGood.durationMin, decouplingPct: longestGood.decouplingPct } : null,
    verdict,
    notes: [
      `Pa:HR-Entkopplung: Leistung je Herzschlag in der zweiten gegen die erste Hälfte der Fahrt, ohne die ersten ${WARMUP_S / 60} min. Unter 5 % gilt als gute Grundlagenausdauer.`,
      `Nur gleichmäßige Fahrten ab ${MIN_RIDE_S / 60} min (Variabilitätsindex bis ${String(MAX_VI).replace(".", ",")}); Intervalltrainings zählen nicht. Aktuell = Median der letzten ${GROUP} Fahrten. Schätzung, keine Diagnose.`,
    ],
  };
}

// --- D1 ----------------------------------------------------------------------------------------

/** Fahrten mit Leistung und Puls je Sekunde im Zeitraum laden (höchstens `limit`, neueste zuerst). */
export async function readHrRideStreams(db: D1Database, fromDay: string, limit = 120): Promise<HrRideStream[]> {
  const { results } = await db
    .prepare(
      `SELECT w.day, w.source, w.source_id FROM workout_streams s JOIN workouts w ON w.source = s.source AND w.source_id = s.source_id
       WHERE w.day >= ? AND s.power IS NOT NULL AND s.heart_rate IS NOT NULL ORDER BY w.start_time DESC LIMIT ?`,
    )
    .bind(fromDay, limit)
    .all<{ day: string; source: string; source_id: string }>();
  const out: HrRideStream[] = [];
  for (const r of results) {
    const s = await readWorkoutStream(db, r.source, r.source_id);
    if (Array.isArray(s?.power) && Array.isArray(s?.heart_rate))
      out.push({ day: r.day, source: r.source, sourceId: r.source_id, power: s!.power as (number | null)[], heartRate: s!.heart_rate as (number | null)[] });
  }
  return out;
}
