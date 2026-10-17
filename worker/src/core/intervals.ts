// Intervall-Qualität (#155): Hauptserie je Intervalltraining aus den erkannten Intervallen, Leistungsabfall von der
// ersten zur letzten Wiederholung, Gleichmäßigkeit und Pulsanstieg, dazu der Verlauf je Intervallart. Reine Funktionen;
// das Lesen steht unten.
import { addDays } from "./analysis";
import { readWorkoutStream } from "./repository";
import { detectIntervals, type Interval } from "./workout-detail";
import { wbalReport, type WbalModel } from "./wbal";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (v: number | null, digits = 1) => String(round(v, digits)).replace(".", ",");

export type IntervalClass = "short" | "vo2" | "threshold" | "long";
export const CLASSES: IntervalClass[] = ["short", "vo2", "threshold", "long"];
export const CLASS_LABELS: Record<IntervalClass, string> = {
  short: "kurz (1–2,5 min)",
  vo2: "VO2max (2,5–8 min)",
  threshold: "Schwelle (8–30 min)",
  long: "lang (ab 30 min)",
};
/** Mindestzahl gleichartiger Wiederholungen für eine Serie. */
export const MIN_REPS = 3;

export const classOf = (durationS: number): IntervalClass => (durationS < 150 ? "short" : durationS < 480 ? "vo2" : durationS < 1800 ? "threshold" : "long");

export interface IntervalRide {
  day: string;
  source: string;
  sourceId: string;
  power: (number | null)[];
  heartRate: (number | null)[] | null;
  cadence: (number | null)[] | null;
}

export type Execution = "even" | "slight" | "strong" | "building";
export const EXECUTION_LABELS: Record<Execution, string> = {
  even: "gleichmäßig",
  slight: "leicht nachgelassen",
  strong: "stark nachgelassen",
  building: "zum Ende stärker",
};

/** Abfall in Prozent: Mittel der ersten gegen die letzten Wiederholungen (ab 4 je zwei, sonst je eine). */
export function fadePct(reps: readonly Interval[]): number | null {
  if (reps.length < 2) return null;
  const k = reps.length >= 4 ? 2 : 1;
  const first = mean(reps.slice(0, k).map((r) => r.avgPowerW))!, last = mean(reps.slice(-k).map((r) => r.avgPowerW))!;
  return first ? ((first - last) / first) * 100 : null;
}

export const executionOf = (fade: number): Execution => (fade < -3 ? "building" : fade <= 3 ? "even" : fade <= 8 ? "slight" : "strong");

/** Hauptserie einer Fahrt: die Dauerklasse mit den meisten Intervallen (bei Gleichstand die längere), ab MIN_REPS. */
export function mainSet(intervals: readonly Interval[]) {
  let best: { cls: IntervalClass; reps: Interval[] } | null = null;
  for (const cls of CLASSES) {
    const reps = intervals.filter((i) => classOf(i.durationS) === cls);
    if (reps.length >= MIN_REPS && (!best || reps.length >= best.reps.length)) best = { cls, reps };
  }
  return best;
}

export function sessionQuality(ride: IntervalRide, ftpW: number | null, model: WbalModel | null = null) {
  const { intervals } = detectIntervals(ride, ftpW);
  const set = mainSet(intervals);
  if (!set) return null;
  const { cls, reps } = set;
  const watts = reps.map((r) => r.avgPowerW);
  const avg = mean(watts)!;
  const sd = Math.sqrt(mean(watts.map((w) => (w - avg) ** 2))!);
  const fade = fadePct(reps)!;
  const hrs = reps.map((r) => r.avgHr);
  const hrCreep = hrs[0] != null && hrs[hrs.length - 1] != null ? hrs[hrs.length - 1]! - hrs[0]! : null;
  return {
    day: ride.day, source: ride.source, sourceId: ride.sourceId,
    cls, label: CLASS_LABELS[cls],
    reps: reps.length,
    repDurationS: Math.round(mean(reps.map((r) => r.durationS))!),
    avgPowerW: Math.round(avg),
    pctFtp: ftpW ? Math.round((avg / ftpW) * 100) : null,
    repPowers: watts,
    fadePct: round(fade, 1)!,
    cvPct: round((sd / avg) * 100, 1)!,
    hrCreepBpm: round(hrCreep),
    execution: executionOf(fade),
    /** Tiefster W′-Stand der Fahrt in % (#208), Modellschätzung; null ohne CP/FTP. */
    wbalMinPct: wbalReport(ride.power, model)?.minPct ?? null,
  };
}

export function intervalReport(rides: readonly IntervalRide[], ftpW: number | null, today: string, days: number, model: WbalModel | null = null) {
  const from = addDays(today, -(days - 1));
  const sessions = rides
    .filter((r) => r.day >= from && r.day <= today)
    .map((r) => sessionQuality(r, ftpW, model))
    .filter((s): s is NonNullable<typeof s> => s != null)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  const classes = CLASSES.flatMap((cls) => {
    const list = sessions.filter((s) => s.cls === cls);
    if (!list.length) return [];
    const first = list[0], latest = list[list.length - 1];
    const best = list.reduce((a, s) => (s.avgPowerW > a.avgPowerW ? s : a));
    return [{
      cls, label: CLASS_LABELS[cls], sessions: list.length,
      latest: { day: latest.day, avgPowerW: latest.avgPowerW, reps: latest.reps, repDurationS: latest.repDurationS, execution: latest.execution },
      best: { day: best.day, avgPowerW: best.avgPowerW },
      changePct: list.length >= 2 ? round(((latest.avgPowerW - first.avgPowerW) / first.avgPowerW) * 100, 1) : null,
      avgFadePct: round(mean(list.map((s) => s.fadePct)), 1),
    }];
  });

  const hints: string[] = [];
  const recent = sessions.slice(-3);
  const strong = recent.filter((s) => s.execution === "strong").length;
  if (recent.length >= 2 && strong >= 2)
    hints.push("In mehreren der letzten Intervalltrainings ist die Leistung zum Ende deutlich abgefallen. Die ersten Wiederholungen etwas ruhiger angehen oder das Ziel um 2–3 % senken; so wird die ganze Serie wirksamer.");
  else if (recent.length >= 2 && recent.every((s) => s.execution === "even" || s.execution === "building"))
    hints.push("Deine letzten Intervalle waren gleichmäßig durchgezogen. Beim nächsten Mal ist eine kleine Steigerung möglich: 2–3 % mehr Leistung oder eine Wiederholung mehr.");
  const last = sessions[sessions.length - 1];
  if (last?.hrCreepBpm != null && last.hrCreepBpm >= 10 && last.execution !== "strong")
    hints.push(`Im letzten Intervalltraining stieg der Puls von der ersten zur letzten Wiederholung um ${last.hrCreepBpm} Schläge. Bei gleicher Leistung spricht das für hohe Belastung; ausreichend Pause zwischen den Wiederholungen einplanen.`);
  for (const c of classes)
    if (c.changePct != null && c.sessions >= 3 && Math.abs(c.changePct) >= 3)
      hints.push(`${c.label}: Intervall-Leistung ${c.changePct > 0 ? "gestiegen" : "gesunken"} um ${fmt(Math.abs(c.changePct))} % seit der ersten Einheit im Zeitraum.`);
  if (!hints.length)
    hints.push(sessions.length ? "Noch keine deutliche Tendenz; nach ein paar weiteren Intervalltrainings wird der Verlauf aussagekräftiger." : "Noch kein Intervalltraining mit Sekundenwerten (FIT-Upload) im Zeitraum. Ab 3 gleichartigen harten Wiederholungen wird eine Einheit ausgewertet.");

  return {
    today,
    range: { from, to: today, days },
    ftpW,
    sessions: sessions.slice(-12).reverse(),
    totalSessions: sessions.length,
    classes,
    hints,
    notes: [
      "Intervalle automatisch erkannt (wie im Workout-Detail: über 88 % der FTP, ohne FTP über 115 % des Fahrtdurchschnitts, ab 60 s). Hauptserie = häufigste Dauerklasse ab 3 Wiederholungen.",
      "Abfall = Leistung der ersten gegen die letzten Wiederholungen (ab 4 Wiederholungen je zwei). Bis 3 % gilt als gleichmäßig, über 8 % als stark nachgelassen.",
      "Trainingshinweise aus deinen Daten, keine Diagnose.",
    ],
  };
}

// --- D1 ----------------------------------------------------------------------------------------

/** Fahrten mit Leistung je Sekunde (Puls und Trittfrequenz, wenn vorhanden), neueste zuerst. */
export async function readIntervalRides(db: D1Database, fromDay: string, limit = 120): Promise<IntervalRide[]> {
  const { results } = await db
    .prepare(
      `SELECT w.day, w.source, w.source_id FROM workout_streams s JOIN workouts w ON w.source = s.source AND w.source_id = s.source_id
       WHERE w.day >= ? AND s.power IS NOT NULL ORDER BY w.start_time DESC LIMIT ?`,
    )
    .bind(fromDay, limit)
    .all<{ day: string; source: string; source_id: string }>();
  const out: IntervalRide[] = [];
  for (const r of results) {
    const s = await readWorkoutStream(db, r.source, r.source_id);
    if (!Array.isArray(s?.power)) continue;
    const arr = (v: unknown) => (Array.isArray(v) ? (v as (number | null)[]) : null);
    out.push({ day: r.day, source: r.source, sourceId: r.source_id, power: s!.power as (number | null)[], heartRate: arr(s!.heart_rate), cadence: arr(s!.cadence) });
  }
  return out;
}
