// Körperwerte und Export (#30): Gewichtsverlauf aus WHOOP und manueller Eingabe, W/kg, Ziel-Fortschritt
// und CSV-Export der eigenen Daten. Rechnen ohne D1, Lesen/Schreiben in eigenen Funktionen unten.
import { addDays, daysBetween } from "./analysis";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Quelle für selbst eingetragene Werte (nicht Teil von `Source`, weil kein Anbieter). */
export const MANUAL = "manual";

export interface BodyRow {
  source: string;
  measured_at: string;
  height_m: number | null;
  weight_kg: number | null;
  max_hr: number | null;
}

export interface WeightPoint {
  day: string;
  weightKg: number;
  source: string;
  /** Gleitender 7-Tage-Mittelwert der vorhandenen Werte (glättet Tagesschwankungen). */
  avg7dKg: number | null;
}

export interface WeightGoal {
  title: string;
  targetValue: number | null;
  targetDate: string | null;
}

export interface BodyReport {
  points: WeightPoint[];
  summary: {
    latest: { day: string; weightKg: number; source: string } | null;
    heightM: number | null;
    bmi: number | null;
    minKg: number | null;
    maxKg: number | null;
    /** Veränderung gegen den letzten Wert vor 7/30/90 Tagen (kg). */
    change7dKg: number | null;
    change30dKg: number | null;
    change90dKg: number | null;
    /** Trend der letzten 28 Tage als Gerade (kg pro Woche, Schätzung). */
    trendKgPerWeek: number | null;
    manualEntries: number;
  };
  wattsPerKg: { value: number | null; ftpW: number | null; ftpOrigin: string };
  goal: (WeightGoal & { remainingKg: number | null; neededKgPerWeek: number | null; onTrack: boolean | null }) | null;
  notes: string[];
}

/** Ein Wert je Tag; eigene Einträge haben Vorrang vor WHOOP. */
export function weightByDay(rows: readonly BodyRow[]) {
  const map = new Map<string, { weightKg: number; source: string }>();
  for (const r of rows) {
    if (r.weight_kg == null || !(r.weight_kg > 0)) continue;
    const day = r.measured_at.slice(0, 10);
    const cur = map.get(day);
    if (!cur || (r.source === MANUAL && cur.source !== MANUAL)) map.set(day, { weightKg: r.weight_kg, source: r.source });
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, v]) => ({ day, ...v }));
}

/** Steigung der Ausgleichsgeraden in kg pro Tag. */
function slopePerDay(pts: { day: string; weightKg: number }[]) {
  if (pts.length < 4) return null;
  const x0 = pts[0].day;
  const xs = pts.map((p) => daysBetween(x0, p.day)), ys = pts.map((p) => p.weightKg);
  if (xs.at(-1)! < 14) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) [num, den] = [num + (xs[i] - mx) * (ys[i] - my), den + (xs[i] - mx) ** 2];
  return den ? num / den : null;
}

export function bodyReport(
  rows: readonly BodyRow[],
  fromDay: string,
  today: string,
  ftp: { watts: number | null; origin: string },
  goal: WeightGoal | null = null,
): BodyReport {
  const all = weightByDay(rows).filter((p) => p.day <= today);
  const valueAt = (day: string) => [...all].reverse().find((p) => p.day <= day) ?? null;
  const points: WeightPoint[] = all
    .filter((p) => p.day >= fromDay)
    .map((p) => {
      const win = all.filter((q) => q.day <= p.day && q.day > addDays(p.day, -7));
      return { ...p, avg7dKg: round(win.reduce((a, q) => a + q.weightKg, 0) / win.length, 2) };
    });
  const latest = all.at(-1) ?? null;
  const change = (n: number) => {
    const ref = latest ? valueAt(addDays(latest.day, -n)) : null;
    return latest && ref ? round(latest.weightKg - ref.weightKg, 1) : null;
  };
  const heightM = rows.find((r) => r.height_m != null && r.height_m > 0)?.height_m ?? null;
  const inView = points.map((p) => p.weightKg);
  const slope = latest ? slopePerDay(all.filter((p) => p.day > addDays(latest.day, -28))) : null;
  const trendKgPerWeek = slope == null ? null : round(slope * 7, 2);

  let goalOut: BodyReport["goal"] = null;
  if (goal) {
    const remainingKg = latest && goal.targetValue != null ? round(goal.targetValue - latest.weightKg, 1) : null;
    const weeksLeft = latest && goal.targetDate && goal.targetDate > latest.day ? daysBetween(latest.day, goal.targetDate) / 7 : null;
    const neededKgPerWeek = remainingKg != null && weeksLeft ? round(remainingKg / weeksLeft, 2) : null;
    // Auf Kurs: Trend zeigt in Zielrichtung und ist mindestens 80 % so schnell wie nötig (oder Ziel schon erreicht).
    const onTrack =
      remainingKg == null ? null
      : Math.abs(remainingKg) <= 0.5 ? true
      : neededKgPerWeek == null || trendKgPerWeek == null ? null
      : Math.sign(trendKgPerWeek) === Math.sign(neededKgPerWeek) && Math.abs(trendKgPerWeek) >= 0.8 * Math.abs(neededKgPerWeek);
    goalOut = { ...goal, remainingKg, neededKgPerWeek, onTrack };
  }

  const notes = ["WHOOP übernimmt das Gewicht aus deinem Profil; eigene Einträge haben Vorrang. Trend und W/kg sind Schätzungen."];
  if (ftp.watts && ftp.origin !== "user") notes.push("W/kg beruht auf einer geschätzten FTP aus deinen Leistungsdaten.");
  if (goalOut?.neededKgPerWeek != null && Math.abs(goalOut.neededKgPerWeek) > 0.7)
    notes.push("Mehr als etwa 0,7 kg pro Woche gilt als sehr schnell; das Zieldatum ggf. anpassen.");

  return {
    points,
    summary: {
      latest,
      heightM,
      bmi: latest && heightM ? round(latest.weightKg / heightM ** 2, 1) : null,
      minKg: inView.length ? Math.min(...inView) : null,
      maxKg: inView.length ? Math.max(...inView) : null,
      change7dKg: change(7),
      change30dKg: change(30),
      change90dKg: change(90),
      trendKgPerWeek,
      manualEntries: all.filter((p) => p.source === MANUAL).length,
    },
    wattsPerKg: { value: ftp.watts && latest ? round(ftp.watts / latest.weightKg, 2) : null, ftpW: ftp.watts, ftpOrigin: ftp.origin },
    goal: goalOut,
    notes,
  };
}

// --- CSV ---------------------------------------------------------------------------------------

/**
 * CSV nach RFC 4180. `excel` = deutsches Excel: Semikolon als Trenner und Dezimalkomma.
 * Werte, die mit = + - @ beginnen und keine Zahl sind, bekommen ein ' vorangestellt (Formel-Injektion).
 */
export function toCsv(rows: readonly Record<string, unknown>[], columns: readonly string[], excel = false): string {
  const sep = excel ? ";" : ",";
  const cell = (v: unknown) => {
    if (v == null) return "";
    if (typeof v === "number") return Number.isFinite(v) ? (excel ? String(v).replace(".", ",") : String(v)) : "";
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(sep), ...rows.map((r) => columns.map((c) => cell(r[c])).join(sep))].join("\r\n") + "\r\n";
}

export const EXPORT_COLUMNS = {
  daily: ["day", "source", "recovery_score", "hrv_ms", "resting_hr", "spo2_pct", "skin_temp_c", "strain", "energy_kj", "avg_hr", "max_hr"],
  sleeps: ["day", "source", "start_time", "end_time", "is_nap", "in_bed_s", "asleep_s", "awake_s", "light_s", "deep_s", "rem_s", "performance_pct", "efficiency_pct", "consistency_pct", "respiratory_rate"],
  workouts: ["day", "source", "source_id", "start_time", "end_time", "sport", "duration_s", "distance_m", "energy_kj", "avg_hr", "max_hr", "avg_power_w", "normalized_power_w", "strain", "avg_cadence_rpm", "tss"],
  body: ["measured_at", "source", "weight_kg", "height_m", "max_hr"],
} as const;

export type ExportDataset = keyof typeof EXPORT_COLUMNS;

// --- D1 ----------------------------------------------------------------------------------------

export async function readBodyHistory(db: D1Database, fromDay: string): Promise<BodyRow[]> {
  const { results } = await db
    .prepare("SELECT source, measured_at, height_m, weight_kg, max_hr FROM body_measurements WHERE measured_at >= ? ORDER BY measured_at")
    .bind(fromDay)
    .all<BodyRow>();
  return results;
}

export async function saveManualWeight(db: D1Database, day: string, weightKg: number) {
  await db
    .prepare("INSERT OR REPLACE INTO body_measurements (source, measured_at, height_m, weight_kg, max_hr) VALUES (?, ?, NULL, ?, NULL)")
    .bind(MANUAL, day, weightKg)
    .run();
}

/** Löscht nur eigene Einträge; WHOOP-Werte bleiben. */
export async function deleteManualWeight(db: D1Database, day: string) {
  const found = await db.prepare("SELECT 1 FROM body_measurements WHERE source = ? AND measured_at = ?").bind(MANUAL, day).first();
  if (!found) return false;
  await db.prepare("DELETE FROM body_measurements WHERE source = ? AND measured_at = ?").bind(MANUAL, day).run();
  return true;
}

/** Rohdaten eines Bereichs für den Export, älteste zuerst. */
export async function readExport(db: D1Database, dataset: ExportDataset, fromDay: string): Promise<Record<string, unknown>[]> {
  const cols = EXPORT_COLUMNS[dataset].join(", ");
  const [table, dayCol, order] =
    dataset === "daily" ? ["daily", "day", "day"]
    : dataset === "sleeps" ? ["sleeps", "day", "start_time"]
    : dataset === "workouts" ? ["workouts", "day", "start_time"]
    : ["body_measurements", "measured_at", "measured_at"];
  const { results } = await db.prepare(`SELECT ${cols} FROM ${table} WHERE ${dayCol} >= ? ORDER BY ${order}`).bind(fromDay).all<Record<string, unknown>>();
  return results;
}
