// Bestleistungen-Feed (#65): neue Rekorde aus Leistungskurve, Kraft-1RM und längsten Fahrten, jeweils mit
// Vorwert, plus „diese Woche gegen letzte Woche“. Reine Funktionen ohne D1.
import { addDays, weekStart, type DayPoint, type MergedWorkout, type WorkoutLoad } from "./analysis";
import type { PowerBestRow } from "./performance";
import { estimate1RM, type StrengthSession } from "./strength";

type LoadedWorkout = MergedWorkout & WorkoutLoad;

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const de = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

export type RecordKind = "power" | "strength" | "distance" | "duration";

export interface RecordEvent {
  day: string;
  kind: RecordKind;
  /** z. B. Dauer in s ("300"), Übung ("squat") oder "ride". */
  key: string;
  label: string;
  value: number;
  unit: string;
  previous: number;
  previousDay: string;
  delta: number;
  text: string;
}

/** Für den Feed relevante Dauern der Leistungskurve. */
export const RECORD_DURATIONS_S = [5, 60, 300, 1200, 3600] as const;

export const durationLabel = (s: number) => (s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : `${s / 3600} h`);

export const isRide = (sport: string | null | undefined) => /cycl|bike|biking|spin|ride|radfahr/i.test(sport ?? "");

/**
 * Rekord = Bestwert, der den bisherigen Bestwert (vor diesem Tag) übertrifft. Der allererste Wert
 * zählt nicht als Rekord, sonst wäre jede erste Fahrt ein Feed-Eintrag.
 */
function progression<T>(items: readonly T[], dayOf: (x: T) => string, valueOf: (x: T) => number | null, minGain: number) {
  const byDay = new Map<string, number>();
  for (const x of items) {
    const v = valueOf(x);
    if (v == null || !(v > 0)) continue;
    const d = dayOf(x);
    byDay.set(d, Math.max(byDay.get(d) ?? 0, v));
  }
  const out: { day: string; value: number; previous: number; previousDay: string }[] = [];
  let best: { value: number; day: string } | null = null;
  for (const [day, value] of [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (best && value > best.value + minGain) out.push({ day, value, previous: best.value, previousDay: best.day });
    if (!best || value > best.value) best = { value, day };
  }
  return out;
}

type RideRow = Pick<LoadedWorkout, "day" | "sport" | "distance_m" | "duration_s">;

export function recordEvents(powerRows: readonly PowerBestRow[], workouts: readonly RideRow[], strength: readonly StrengthSession[]): RecordEvent[] {
  const events: RecordEvent[] = [];
  for (const d of RECORD_DURATIONS_S) {
    for (const r of progression(powerRows.filter((p) => p.duration_s === d), (p) => p.day, (p) => p.watts, 0)) {
      const label = `${durationLabel(d).replace(" ", "-")}-Leistung`;
      events.push({ ...r, kind: "power", key: String(d), label, unit: "W", delta: Math.round(r.value - r.previous),
        text: `Neue ${durationLabel(d).replace(" ", "-")}-Bestleistung: ${Math.round(r.value)} W (+${Math.round(r.value - r.previous)} W)` });
    }
  }

  const exercises = new Map<string, { name: string; sets: { day: string; e1rm: number | null }[] }>();
  for (const s of strength)
    for (const set of s.sets) {
      const e = exercises.get(set.exercise) ?? { name: set.exerciseName || set.exercise, sets: [] };
      e.sets.push({ day: s.day, e1rm: estimate1RM(set.weightKg, set.reps) });
      exercises.set(set.exercise, e);
    }
  for (const [key, e] of exercises) {
    // Unter 1 % gilt als Messrauschen der Schätzung.
    for (const r of progression(e.sets, (x) => x.day, (x) => x.e1rm, 0).filter((r) => r.value > r.previous * 1.01)) {
      events.push({ ...r, kind: "strength", key, label: `${e.name} (geschätztes 1RM)`, unit: "kg", delta: round(r.value - r.previous)!,
        text: `${e.name}: geschätztes 1RM ${de(r.value, 1)} kg (+${de(r.value - r.previous, 1)} kg)` });
    }
  }

  const rides = workouts.filter((w) => isRide(w.sport));
  for (const r of progression(rides, (w) => w.day, (w) => (w.distance_m ? w.distance_m / 1000 : null), 0.5)) {
    events.push({ ...r, value: round(r.value)!, previous: round(r.previous)!, kind: "distance", key: "ride", label: "Längste Fahrt", unit: "km", delta: round(r.value - r.previous)!,
      text: `Längste Fahrt: ${de(r.value, 1)} km (+${de(r.value - r.previous, 1)} km)` });
  }
  for (const r of progression(rides, (w) => w.day, (w) => (w.duration_s ? w.duration_s / 60 : null), 5)) {
    events.push({ ...r, value: Math.round(r.value), previous: Math.round(r.previous), kind: "duration", key: "ride", label: "Längste Ausfahrt (Zeit)", unit: "min", delta: Math.round(r.value - r.previous),
      text: `Längste Ausfahrt: ${Math.floor(r.value / 60)}:${String(Math.round(r.value % 60)).padStart(2, "0")} h (+${Math.round(r.value - r.previous)} min)` });
  }
  return events.sort((a, b) => (a.day === b.day ? a.kind.localeCompare(b.kind) : a.day < b.day ? 1 : -1));
}

export interface WeekStats {
  from: string;
  to: string;
  days: number;
  workouts: number;
  trainingH: number;
  load: number;
  avgRecovery: number | null;
  avgHrv: number | null;
  avgSleepH: number | null;
  avgStrain: number | null;
}

function stats(series: readonly DayPoint[], from: string, to: string): WeekStats {
  const pts = series.filter((p) => p.day >= from && p.day <= to);
  return {
    from, to, days: pts.length,
    workouts: pts.reduce((a, p) => a + p.workouts, 0),
    trainingH: round(pts.reduce((a, p) => a + p.trainingMin, 0) / 60, 1)!,
    load: Math.round(pts.reduce((a, p) => a + p.load, 0)),
    avgRecovery: round(mean(pts.map((p) => p.recovery)), 0),
    avgHrv: round(mean(pts.map((p) => p.hrv)), 0),
    avgSleepH: round(mean(pts.map((p) => p.sleepH)), 2),
    avgStrain: round(mean(pts.map((p) => p.strain)), 1),
  };
}

/** Diese Woche bis heute gegen dieselben Wochentage der Vorwoche (fairer Vergleich) und die ganze Vorwoche. */
export function weekCompare(series: readonly DayPoint[], today: string) {
  const ws = weekStart(today), lw = addDays(ws, -7);
  const thisWeek = stats(series, ws, today);
  const lastWeekSamePeriod = stats(series, lw, addDays(today, -7));
  const lastWeekFull = stats(series, lw, addDays(ws, -1));
  const diff = (k: "trainingH" | "load" | "avgRecovery" | "avgHrv" | "avgSleepH" | "workouts") => {
    const a = thisWeek[k], b = lastWeekSamePeriod[k];
    return a == null || b == null ? null : round(a - b, k === "avgSleepH" ? 2 : 1);
  };
  return {
    thisWeek, lastWeekSamePeriod, lastWeekFull,
    change: { trainingH: diff("trainingH"), load: diff("load"), workouts: diff("workouts"), avgRecovery: diff("avgRecovery"), avgHrv: diff("avgHrv"), avgSleepH: diff("avgSleepH") },
  };
}

export function recordsReport(
  input: { powerRows: readonly PowerBestRow[]; workouts: readonly RideRow[]; strength: readonly StrengthSession[]; series: readonly DayPoint[] },
  today: string,
  days: number,
) {
  const from = addDays(today, -(days - 1));
  const all = recordEvents(input.powerRows, input.workouts, input.strength);
  return {
    today,
    range: { from, to: today, days },
    records: all.filter((e) => e.day >= from && e.day <= today),
    totalRecords: all.length,
    week: weekCompare(input.series, today),
    notes: [
      "Rekord = besser als alle früheren Werte; der erste Wert einer Dauer oder Übung zählt nicht. Leistungsrekorde nur aus Fahrten mit Wattdaten (FIT-Import).",
      "1RM nach Epley aus Sätzen bis 12 Wiederholungen, Fortschritte unter 1 % zählen nicht. Schätzung.",
    ],
  };
}
