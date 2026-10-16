// Workout-Detail aus Sekundenwerten (FIT-Import): Verlauf für Diagramme, Zeit in Zonen,
// erkannte Intervalle, Pa:HR-Entkopplung und Kennzahlen. Reine Funktionen plus ein Lader für D1.
import { analysisContext } from "./analytics";
import { normalizedPower } from "./power";
import { zonesFor, type Zone } from "./performance";
import { readWorkoutStream } from "./repository";

type Series = (number | null)[] | null;

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

function mean(values: Iterable<number | null>): number | null {
  let sum = 0, n = 0;
  for (const v of values) if (v != null) (sum += v), n++;
  return n ? sum / n : null;
}

// --- Verlauf ------------------------------------------------------------------------------------

export interface SeriesPoint {
  /** Sekunde ab Start (Anfang des Abschnitts). */
  t: number;
  power: number | null;
  hr: number | null;
  cadence: number | null;
}

/** Verkleinert die Sekundenreihen auf höchstens `maxPoints` Punkte (Mittel je Abschnitt). */
export function downsample(s: { power: Series; heartRate: Series; cadence: Series }, maxPoints = 600): { stepS: number; points: SeriesPoint[] } {
  const length = Math.max(s.power?.length ?? 0, s.heartRate?.length ?? 0, s.cadence?.length ?? 0);
  const stepS = Math.max(1, Math.ceil(length / Math.max(1, maxPoints)));
  const points: SeriesPoint[] = [];
  const avgOf = (x: Series, from: number, to: number) => (x ? round(mean(x.slice(from, to))) : null);
  for (let t = 0; t < length; t += stepS) {
    points.push({ t, power: avgOf(s.power, t, t + stepS), hr: avgOf(s.heartRate, t, t + stepS), cadence: avgOf(s.cadence, t, t + stepS) });
  }
  return { stepS, points };
}

// --- Zonen --------------------------------------------------------------------------------------

export interface ZoneTime extends Zone {
  seconds: number;
  sharePct: number;
}

/** Zeit je Zone aus Sekundenwerten (Sekunden ohne Wert zählen nicht; 0 W zählt in Zone 1). */
export function timeInZones(series: Series, zones: readonly Zone[] | null): ZoneTime[] | null {
  if (!series || !zones?.length) return null;
  const secs = zones.map(() => 0);
  let total = 0;
  for (const v of series) {
    if (v == null) continue;
    let i = zones.findIndex((z) => z.max == null || v <= z.max);
    if (i < 0) i = zones.length - 1;
    secs[i]++;
    total++;
  }
  if (!total) return null;
  return zones.map((z, i) => ({ ...z, seconds: secs[i], sharePct: round((secs[i] / total) * 100, 1)! }));
}

// --- Intervalle ---------------------------------------------------------------------------------

export interface Interval {
  startS: number;
  durationS: number;
  avgPowerW: number;
  /** Anteil der FTP in Prozent (nur mit FTP). */
  pctFtp: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgCadence: number | null;
}

/** Mindestlänge eines Intervalls und größte Lücke darin, in Sekunden. */
const MIN_INTERVAL_S = 60;
const MAX_GAP_S = 15;
const MAX_INTERVALS = 30;

/**
 * Erkennt harte Abschnitte: 30-s-Mittel der Leistung über der Schwelle (88 % der FTP, ohne FTP
 * 115 % der Durchschnittsleistung der Fahrt), mindestens 60 s, kurze Einbrüche bis 15 s überbrückt.
 */
export function detectIntervals(s: { power: Series; heartRate: Series; cadence: Series }, ftpW: number | null): { thresholdW: number | null; basis: "ftp" | "average"; intervals: Interval[] } {
  const p = s.power;
  const avg = p ? mean(p.map((v) => v ?? 0)) : null;
  const thresholdW = ftpW ? ftpW * 0.88 : avg ? avg * 1.15 : null;
  const basis = ftpW ? "ftp" : "average";
  if (!p || p.length < MIN_INTERVAL_S || !thresholdW) return { thresholdW: round(thresholdW), basis, intervals: [] };

  // 30-s-Mittel, zentriert auf die Sekunde, damit Anfang und Ende nicht verschoben werden.
  const prefix = new Float64Array(p.length + 1);
  for (let i = 0; i < p.length; i++) prefix[i + 1] = prefix[i] + (p[i] ?? 0);
  const smooth = (i: number) => {
    const a = Math.max(0, i - 15), b = Math.min(p.length, i + 15);
    return (prefix[b] - prefix[a]) / (b - a);
  };

  const segments: [number, number][] = [];
  let start = -1, lastHigh = -1;
  for (let i = 0; i <= p.length; i++) {
    const high = i < p.length && smooth(i) >= thresholdW;
    if (high) {
      if (start < 0) start = i;
      lastHigh = i;
    } else if (start >= 0 && i - lastHigh > MAX_GAP_S) {
      segments.push([start, lastHigh + 1]);
      start = -1;
    }
  }
  if (start >= 0) segments.push([start, lastHigh + 1]);

  const intervals = segments
    .filter(([a, b]) => b - a >= MIN_INTERVAL_S)
    .slice(0, MAX_INTERVALS)
    .map(([a, b]) => {
      const hr = s.heartRate?.slice(a, b) ?? [];
      const hrValues = hr.filter((v): v is number => v != null);
      const avgPowerW = Math.round((prefix[b] - prefix[a]) / (b - a));
      return {
        startS: a,
        durationS: b - a,
        avgPowerW,
        pctFtp: ftpW ? Math.round((avgPowerW / ftpW) * 100) : null,
        avgHr: round(mean(hr)),
        maxHr: hrValues.length ? hrValues.reduce((x, y) => Math.max(x, y)) : null,
        avgCadence: round(mean(s.cadence?.slice(a, b) ?? [])),
      };
    });
  return { thresholdW: round(thresholdW), basis, intervals };
}

// --- Entkopplung --------------------------------------------------------------------------------

/**
 * Pa:HR-Entkopplung: Verhältnis Leistung/Puls in der ersten gegen die zweite Hälfte, in Prozent.
 * Unter ~5 % gilt als gute aerobe Ausdauer; aussagekräftig nur bei gleichmäßigen Fahrten ≥ 20 min.
 */
export function decoupling(power: Series, hr: Series): { pct: number; firstHalf: number; secondHalf: number } | null {
  if (!power || !hr) return null;
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(power.length, hr.length); i++) {
    const p = power[i], h = hr[i];
    if (p != null && p > 0 && h != null && h > 0) pairs.push([p, h]);
  }
  if (pairs.length < 20 * 60) return null;
  const half = Math.floor(pairs.length / 2);
  const ratio = (xs: [number, number][]) => mean(xs.map((x) => x[0]))! / mean(xs.map((x) => x[1]))!;
  const first = ratio(pairs.slice(0, half));
  const second = ratio(pairs.slice(half));
  return { pct: round(((first - second) / first) * 100, 1)!, firstHalf: round(first, 2)!, secondHalf: round(second, 2)! };
}

// --- Zusammenfassung ----------------------------------------------------------------------------

export interface StreamInput {
  power: Series;
  heartRate: Series;
  cadence: Series;
}

export function workoutDetail(s: StreamInput, ref: { ftpW: number | null; thresholdHr: number | null }, maxPoints = 600) {
  const avgPower = s.power ? mean(s.power.map((v) => v ?? 0)) : null;
  const np = s.power ? normalizedPower(s.power) : null;
  const durationS = Math.max(s.power?.length ?? 0, s.heartRate?.length ?? 0, s.cadence?.length ?? 0);
  const intensity = np && ref.ftpW ? np / ref.ftpW : null;
  const zones = zonesFor(ref);
  return {
    stats: {
      durationS,
      avgPowerW: round(avgPower),
      normalizedPowerW: round(np),
      maxPowerW: s.power ? s.power.reduce<number>((m, v) => Math.max(m, v ?? 0), 0) : null,
      variabilityIndex: np && avgPower ? round(np / avgPower, 2) : null,
      intensityFactor: round(intensity, 2),
      tssEstimate: intensity != null ? round((durationS / 3600) * intensity * intensity * 100) : null,
      workKj: s.power ? round(s.power.reduce<number>((a, v) => a + (v ?? 0), 0) / 1000) : null,
      avgHr: round(mean(s.heartRate ?? [])),
      maxHr: s.heartRate ? s.heartRate.reduce<number | null>((m, v) => (v != null && (m == null || v > m) ? v : m), null) : null,
      avgCadence: round(mean((s.cadence ?? []).filter((v) => v != null && v > 0))),
    },
    reference: ref,
    series: downsample(s, maxPoints),
    zones: { power: timeInZones(s.power, zones.power), hr: timeInZones(s.heartRate, zones.hr) },
    intervals: detectIntervals(s, ref.ftpW),
    decoupling: decoupling(s.power, s.heartRate),
  };
}

const parseCurve = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, number>) : null);

/** Lädt Workout, Sekundenwerte und wirksame Einstellungen (FTP ggf. geschätzt) und rechnet das Detail. */
export async function loadWorkoutDetail(db: D1Database, source?: string, sourceId?: string, maxPoints?: number) {
  const ctx = await analysisContext(db, { days: 7 });
  const available = await listDetailWorkouts(db, 20);
  const target = source && sourceId ? { source, source_id: sourceId } : available[0];
  if (!target) return { found: false as const, available, message: "Noch keine Fahrt mit Sekundenwerten (FIT-Datei) vorhanden." };
  const stream = await readWorkoutStream(db, target.source, target.source_id);
  if (!stream) return { found: false as const, available, message: "Für dieses Workout gibt es keine Sekundenwerte (nur Fahrten aus FIT-Dateien)." };
  const workout = await db
    .prepare(
      `SELECT day, source, source_id, start_time, end_time, sport, duration_s, distance_m, energy_kj, avg_hr, max_hr,
         avg_power_w, normalized_power_w, strain, avg_cadence_rpm, tss FROM workouts WHERE source = ? AND source_id = ?`,
    )
    .bind(target.source, target.source_id)
    .first();
  const ref = { ftpW: ctx.settings.ftpW, thresholdHr: ctx.settings.thresholdHr };
  return {
    found: true as const,
    workout,
    ftpOrigin: ctx.settings.origin.ftpW ?? null,
    ...workoutDetail({ power: stream.power, heartRate: stream.heart_rate, cadence: stream.cadence }, ref, maxPoints),
    powerCurve: parseCurve(stream.power_curve),
    available,
    notes: [
      "Zonen: Leistung nach Coggan (FTP), Puls nach Friel (Schwellenpuls); ohne FTP bzw. Schwellenpuls keine Zonen.",
      "Intervalle automatisch erkannt (30-s-Mittel über 88 % der FTP, ohne FTP über 115 % des Fahrtdurchschnitts, ab 60 s).",
      "Entkopplung (Pa:HR) unter ca. 5 % spricht für gute Grundlagenausdauer; nur bei gleichmäßigen Fahrten aussagekräftig.",
      "IF, TSS und Zonen beruhen auf der FTP; ist sie geschätzt, sind es diese Werte auch. Trainingshinweise, keine Diagnose.",
    ],
  };
}

/** Workouts mit Sekundenwerten, neueste zuerst (Auswahlliste fürs Detail). */
export async function listDetailWorkouts(db: D1Database, limit = 20) {
  const { results } = await db
    .prepare(
      `SELECT w.day, w.source, w.source_id, w.start_time, w.sport, w.duration_s, w.avg_power_w, w.normalized_power_w
       FROM workout_streams s JOIN workouts w ON w.source = s.source AND w.source_id = s.source_id
       ORDER BY w.start_time DESC LIMIT ?`,
    )
    .bind(limit)
    .all<{ day: string; source: string; source_id: string; start_time: string; sport: string | null; duration_s: number; avg_power_w: number | null; normalized_power_w: number | null }>();
  return results;
}
