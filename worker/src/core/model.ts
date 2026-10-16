// Gemeinsames Datenmodell. Anbieter übersetzen ihre Daten hierher (src/providers/<anbieter>/map.ts);
// Auswertung, Coach und Connector-Werkzeuge kennen nur diese Typen.

export type Source = "whoop" | "wahoo" | "mywhoosh";

interface Base {
  source: Source;
  sourceId: string;
  /** Lokales Datum des Nutzers, YYYY-MM-DD. */
  day: string;
}

export interface Daily extends Base {
  startTime: string;
  endTime: string | null;
  strain: number | null;
  energyKj: number | null;
  avgHr: number | null;
  maxHr: number | null;
}

export interface Recovery {
  source: Source;
  /** ID des Tages (Daily.sourceId), zu dem die Erholung gehört. */
  dailySourceId: string;
  recoveryScore: number | null;
  restingHr: number | null;
  hrvMs: number | null;
  spo2Pct: number | null;
  skinTempC: number | null;
}

export interface Sleep extends Base {
  startTime: string;
  endTime: string;
  isNap: boolean;
  inBedS: number | null;
  asleepS: number | null;
  awakeS: number | null;
  lightS: number | null;
  deepS: number | null;
  remS: number | null;
  performancePct: number | null;
  efficiencyPct: number | null;
  consistencyPct: number | null;
  respiratoryRate: number | null;
}

export interface Workout extends Base {
  startTime: string;
  endTime: string;
  sport: string | null;
  durationS: number;
  distanceM: number | null;
  energyKj: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPowerW: number | null;
  normalizedPowerW: number | null;
  strain: number | null;
}

export interface BodyMeasurement {
  source: Source;
  measuredAt: string;
  heightM: number | null;
  weightKg: number | null;
  maxHr: number | null;
}

/** Lokales Datum aus einer UTC-Zeit und einem Offset wie "+02:00" oder "-05:30". */
export function localDay(isoUtc: string, offset: string | null | undefined): string {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset ?? "");
  const minutes = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(Date.parse(isoUtc) + minutes * 60_000).toISOString().slice(0, 10);
}
