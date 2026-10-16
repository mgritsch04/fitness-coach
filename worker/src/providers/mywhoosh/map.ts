// Übersetzt eine FIT-Datei (MyWhoosh-Export) ins gemeinsame Datenmodell: ein Workout mit
// Kennzahlen plus Sekundenreihen (Leistung, Puls, Trittfrequenz) und Bestleistungskurve.
import type { Workout, WorkoutStream } from "../../core/model";
import { meanMaxPower, normalizedPower } from "../../core/power";
import { FIT_EPOCH_S, FitError, fitTimeToIso, parseFit, type FitMessage } from "./fit";

const MSG = { session: 18, record: 20, activity: 34 } as const;

/** FIT-Sportarten (Auszug aus dem FIT-Profil). */
const SPORTS: Record<number, string> = { 1: "running", 2: "cycling", 5: "swimming", 11: "walking", 15: "rowing", 17: "hiking" };

/** Längste gespeicherte Sekundenreihe (12 h), damit eine Zeile in D1 klein bleibt. */
const MAX_STREAM_S = 12 * 3600;
/** Lücken bis zu dieser Länge werden mit dem letzten Wert gefüllt (Aufzeichnung mit Aussetzern). */
const FILL_GAP_S = 5;

export interface FitImport {
  workout: Workout;
  stream: WorkoutStream | null;
}

const num = (m: FitMessage | undefined, field: number, scale = 1): number | null => {
  const v = m?.fields.get(field);
  return typeof v === "number" ? v / scale : null;
};
const round = (v: number | null, digits = 0) => (v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits);

/** Lokales Datum in einer IANA-Zeitzone (Fallback, wenn die Datei keine Ortszeit enthält). */
function zonedDay(isoUtc: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(isoUtc));
  } catch {
    return isoUtc.slice(0, 10);
  }
}

/** Sekundenreihen aus den record-Nachrichten, ab `start` (FIT-Zeit), 1 Wert pro Sekunde. */
function streams(records: FitMessage[], start: number) {
  const last = records.reduce((m, r) => Math.max(m, num(r, 253) ?? start), start);
  const length = Math.min(MAX_STREAM_S, Math.max(0, last - start + 1));
  const make = () => new Array<number | null>(length).fill(null);
  const series = { power: make(), heartRate: make(), cadence: make() };
  const fieldOf = { power: 7, heartRate: 3, cadence: 4 } as const;
  for (const r of records) {
    const t = num(r, 253);
    if (t == null || t < start || t - start >= length) continue;
    for (const k of Object.keys(series) as (keyof typeof series)[]) {
      const v = num(r, fieldOf[k]);
      if (v != null) series[k][t - start] = v;
    }
  }
  for (const s of Object.values(series)) {
    let lastIdx = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] == null) continue;
      if (lastIdx >= 0 && i - lastIdx > 1 && i - lastIdx <= FILL_GAP_S) s.fill(s[lastIdx], lastIdx + 1, i);
      lastIdx = i;
    }
  }
  const any = (s: (number | null)[]) => (s.some((v) => v != null) ? s : null);
  return { power: any(series.power), heartRate: any(series.heartRate), cadence: any(series.cadence) };
}

const avg = (s: (number | null)[] | null) => {
  const v = (s ?? []).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const max = (s: (number | null)[] | null) => {
  const v = (s ?? []).filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => Math.max(a, b)) : null;
};

/**
 * Liest eine MyWhoosh-FIT-Datei. Kennzahlen kommen aus der session-Nachricht; fehlen sie,
 * werden sie aus den Sekundenwerten berechnet. `timeZone` gilt nur, wenn die Datei keine Ortszeit hat.
 */
export function mapFit(bytes: Uint8Array, timeZone: string): FitImport {
  const messages = parseFit(bytes);
  const session = messages.find((m) => m.global === MSG.session);
  const activity = messages.find((m) => m.global === MSG.activity);
  const records = messages.filter((m) => m.global === MSG.record && num(m, 253) != null);
  if (!session && records.length === 0) throw new FitError("Die FIT-Datei enthält keine Trainingsdaten.");

  const times = records.map((r) => num(r, 253)!);
  const first = times.reduce((a, b) => Math.min(a, b), Infinity);
  const lastTime = times.reduce((a, b) => Math.max(a, b), -Infinity);
  const start = num(session, 2) ?? first;
  const startTime = fitTimeToIso(start);
  const s = records.length ? streams(records, start) : { power: null, heartRate: null, cadence: null };
  const recordSpan = records.length ? lastTime - start : 0;

  const elapsedS = num(session, 7, 1000) ?? recordSpan;
  const durationS = Math.round(num(session, 8, 1000) ?? elapsedS);
  const kcal = num(session, 11);
  const lastRecordDistance = records.length ? num(records[records.length - 1], 5, 100) : null;

  // Ortszeit: activity.local_timestamp − activity.timestamp ergibt den Versatz zu UTC.
  const localTs = num(activity, 5);
  const actTs = num(activity, 253);
  const day =
    localTs != null && actTs != null && Math.abs(localTs - actTs) <= 14 * 3600
      ? new Date((start + localTs - actTs + FIT_EPOCH_S) * 1000).toISOString().slice(0, 10)
      : zonedDay(startTime, timeZone);

  const avgPower = num(session, 20) ?? round(avg(s.power));
  const np = num(session, 34) ?? (s.power ? round(normalizedPower(s.power)) : null);
  const sportNum = num(session, 5);

  const workout: Workout = {
    source: "mywhoosh",
    // Startzeit ist je Fahrt eindeutig; ein erneuter Upload derselben Datei aktualisiert die Zeile.
    sourceId: `fit-${startTime}`,
    day,
    startTime,
    endTime: new Date(Date.parse(startTime) + Math.round(elapsedS) * 1000).toISOString(),
    sport: (sportNum != null && SPORTS[sportNum]) || (sportNum == null ? "cycling" : null),
    durationS,
    distanceM: round(num(session, 9, 100) ?? lastRecordDistance, 1),
    // Wie bei WHOOP/Wahoo: verbrauchte Energie (kcal → kJ), nicht die mechanische Arbeit.
    energyKj: kcal != null ? Math.round(kcal * 4.184) : null,
    avgHr: round(num(session, 16) ?? avg(s.heartRate)),
    maxHr: num(session, 17) ?? max(s.heartRate),
    avgPowerW: avgPower,
    normalizedPowerW: np,
    strain: null,
    avgCadenceRpm: round(num(session, 18) ?? avg(s.cadence)),
    tss: round(num(session, 35, 10), 1),
  };

  const stream: WorkoutStream | null =
    s.power || s.heartRate || s.cadence
      ? {
          source: "mywhoosh",
          sourceId: workout.sourceId,
          startTime,
          power: s.power,
          heartRate: s.heartRate,
          cadence: s.cadence,
          powerCurve: s.power ? meanMaxPower(s.power) : null,
        }
      : null;
  return { workout, stream };
}
