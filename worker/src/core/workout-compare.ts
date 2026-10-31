// Zwei Fahrten vergleichen (#219): Kennzahlen nebeneinander, Puls bei gleicher Leistung, Bestleistungen je Dauer.
// Reine Funktionen auf den Ergebnissen von workoutDetail() und den Sekundenreihen; Lader für D1 in loadWorkoutCompare().
import { analysisContext } from "./analytics";
import { readWorkoutStream } from "./repository";
import { listDetailWorkouts, workoutDetail } from "./workout-detail";

type Series = (number | null)[] | null;

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Breite der Leistungsstufen und Mindestzeit je Stufe, damit ein Pulsvergleich etwas aussagt. */
export const BAND_W = 20;
export const MIN_BAND_S = 120;
/** Bestleistungen, die verglichen werden (Sekunden). */
export const CURVE_DURATIONS_S = [60, 300, 600, 1200, 3600] as const;

export interface BandRow { fromW: number; toW: number; aSeconds: number; bSeconds: number; aHr: number; bHr: number; diffHr: number }

/** Durchschnittspuls je Leistungsstufe (nur Sekunden mit Leistung > 0 und Puls). */
function hrByBand(power: Series, hr: Series) {
  const bands = new Map<number, { n: number; sum: number }>();
  if (!power || !hr) return bands;
  for (let i = 0; i < Math.min(power.length, hr.length); i++) {
    const p = power[i], h = hr[i];
    if (p == null || h == null || p <= 0 || h <= 0) continue;
    const k = Math.floor(p / BAND_W);
    const b = bands.get(k) ?? { n: 0, sum: 0 };
    b.n++; b.sum += h; bands.set(k, b);
  }
  return bands;
}

/** Puls bei gleicher Leistung: nur Stufen, in denen beide Fahrten mindestens MIN_BAND_S haben. diffHr < 0: B bei gleicher Leistung mit niedrigerem Puls. */
export function hrAtSamePower(a: { power: Series; heartRate: Series }, b: { power: Series; heartRate: Series }): BandRow[] {
  const ba = hrByBand(a.power, a.heartRate), bb = hrByBand(b.power, b.heartRate);
  const rows: BandRow[] = [];
  for (const [k, x] of [...ba].sort((p, q) => p[0] - q[0])) {
    const y = bb.get(k);
    if (!y || x.n < MIN_BAND_S || y.n < MIN_BAND_S) continue;
    const aHr = x.sum / x.n, bHr = y.sum / y.n;
    rows.push({ fromW: k * BAND_W, toW: (k + 1) * BAND_W, aSeconds: x.n, bSeconds: y.n, aHr: round(aHr, 1)!, bHr: round(bHr, 1)!, diffHr: round(bHr - aHr, 1)! });
  }
  return rows;
}

const STAT_KEYS = ["durationS", "avgPowerW", "normalizedPowerW", "maxPowerW", "intensityFactor", "variabilityIndex", "tssEstimate", "workKj", "avgHr", "maxHr", "avgCadence"] as const;

/** Kennzahl für Kennzahl: A, B und Differenz B − A (null, wenn eine Seite fehlt). */
export function diffStats(a: Record<string, number | null>, b: Record<string, number | null>) {
  return STAT_KEYS.map((key) => {
    const av = a[key] ?? null, bv = b[key] ?? null;
    return { key, a: av, b: bv, diff: av != null && bv != null ? round(bv - av, 2) : null, diffPct: av != null && bv != null && av !== 0 ? round(((bv - av) / av) * 100, 1) : null };
  });
}

/** Beste Durchschnittsleistung je Dauer, wo beide Fahrten einen Wert haben. */
export function diffCurves(a: Record<string, number> | null, b: Record<string, number> | null) {
  return CURVE_DURATIONS_S.map((durationS) => {
    const av = a?.[String(durationS)] ?? null, bv = b?.[String(durationS)] ?? null;
    return { durationS, a: av, b: bv, diffW: av != null && bv != null ? Math.round(bv - av) : null };
  }).filter((r) => r.a != null || r.b != null);
}

/** Kurzfazit in Worten; nur bei genug Vergleichsstufen, als Schätzung gekennzeichnet. */
export function compareVerdict(bands: BandRow[]): string | null {
  const total = bands.reduce((s, r) => s + Math.min(r.aSeconds, r.bSeconds), 0);
  if (!bands.length || total < 300) return null;
  const avg = bands.reduce((s, r) => s + r.diffHr * Math.min(r.aSeconds, r.bSeconds), 0) / total;
  const d = round(avg, 1)!;
  if (Math.abs(d) < 1.5) return `Bei gleicher Leistung ist der Puls praktisch gleich (${d > 0 ? "+" : ""}${d} /min im Mittel). Einzelne Fahrten schwanken mit Tagesform, Hitze und Schlaf.`;
  return d < 0
    ? `Bei gleicher Leistung liegt der Puls in B im Mittel ${Math.abs(d)} /min niedriger. Das spricht für bessere Ausdauer, kann aber auch an Tagesform oder Temperatur liegen.`
    : `Bei gleicher Leistung liegt der Puls in B im Mittel ${d} /min höher. Das kann an Müdigkeit, Hitze oder Tagesform liegen, ist keine Diagnose.`;
}

type Candidate = { day: string; source: string; source_id: string; sport: string | null; duration_s: number };

/** Passende Vergleichsfahrten zu `target`: ähnliche Dauer (±25 %), gleiche Sportart, nächste zuerst im Datum. */
export function similarRides(target: Candidate, all: Candidate[], max = 5): Candidate[] {
  return all
    .filter((c) => !(c.source === target.source && c.source_id === target.source_id))
    .filter((c) => (c.sport ?? "") === (target.sport ?? ""))
    .filter((c) => target.duration_s > 0 && Math.abs(c.duration_s - target.duration_s) / target.duration_s <= 0.25)
    .slice(0, max);
}

export type RideRef = { source: string; sourceId: string };

export async function loadWorkoutCompare(db: D1Database, a: RideRef | undefined, b: RideRef | undefined) {
  const available = await listDetailWorkouts(db, 50);
  const first = a ?? (available[0] ? { source: available[0].source, sourceId: available[0].source_id } : undefined);
  if (!first) return { found: false as const, available, message: "Noch keine Fahrt mit Sekundenwerten (FIT-Datei) vorhanden." };
  const targetRow = available.find((w) => w.source === first.source && w.source_id === first.sourceId);
  const suggestions = targetRow ? similarRides(targetRow, available) : [];
  if (!b) return { found: false as const, available, suggestions, message: "Zweite Fahrt wählen (b) oder eine der Vorschläge nehmen." };
  const [sa, sb] = await Promise.all([readWorkoutStream(db, first.source, first.sourceId), readWorkoutStream(db, b.source, b.sourceId)]);
  if (!sa || !sb) return { found: false as const, available, suggestions, message: "Für mindestens eine der Fahrten gibt es keine Sekundenwerte (nur Fahrten aus FIT-Dateien)." };
  const ctx = await analysisContext(db, { days: 7 });
  const ref = { ftpW: ctx.settings.ftpW, thresholdHr: ctx.settings.thresholdHr };
  const da = workoutDetail({ power: sa.power, heartRate: sa.heart_rate, cadence: sa.cadence }, ref, 50);
  const dbb = workoutDetail({ power: sb.power, heartRate: sb.heart_rate, cadence: sb.cadence }, ref, 50);
  const label = async (r: RideRef) => (await db.prepare("SELECT day, sport, start_time FROM workouts WHERE source = ? AND source_id = ?").bind(r.source, r.sourceId).first()) ?? null;
  const bands = hrAtSamePower({ power: sa.power, heartRate: sa.heart_rate }, { power: sb.power, heartRate: sb.heart_rate });
  const curve = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, number>) : null);
  return {
    found: true as const,
    a: { ...first, workout: await label(first) },
    b: { ...b, workout: await label(b) },
    stats: diffStats(da.stats as unknown as Record<string, number | null>, dbb.stats as unknown as Record<string, number | null>),
    hrAtPower: bands,
    bestPower: diffCurves(curve(sa.power_curve), curve(sb.power_curve)),
    verdict: compareVerdict(bands),
    suggestions, available,
    notes: [
      `Puls bei gleicher Leistung: Stufen von ${BAND_W} W, nur wo beide Fahrten mindestens ${MIN_BAND_S / 60} min haben. diffHr = B − A, negativ heißt niedrigerer Puls in B.`,
      "Differenzen sind B − A. Schätzungen und Trainingshinweise, keine Diagnose.",
    ],
  };
}
