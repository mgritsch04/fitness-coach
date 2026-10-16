// Kraft und Rad im Wechselspiel (#113): Wie wirken Beineinheiten auf Erholung/HRV am Folgetag und auf die
// nächste Radeinheit (Effizienz, Intensität harter Einheiten), je nach Abstand? Beobachtungen aus den eigenen
// Daten, keine Ursache-Wirkung. Reine Funktionen ohne D1.
import { addDays, type DayPoint, type MergedWorkout, type WorkoutLoad } from "./analysis";
import { isRide } from "./records";
import { LEG_MUSCLES, musclesOf, type StrengthSession } from "./strength";

type LoadedWorkout = MergedWorkout & WorkoutLoad;

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const H = 3_600_000;

/** Ab so vielen Sätzen mit Beinmuskeln als Hauptmuskel (Quadrizeps, Beinbizeps, Gesäß) gilt eine Einheit als Beineinheit. */
export const MIN_LEG_SETS = 3;
/** Mindestanzahl je Gruppe, damit ein Vergleich gezeigt wird. */
export const MIN_GROUP = 3;
/** Harte Radeinheit: Intensitätsfaktor ab 0,85. */
export const HARD_IF = 0.85;

export interface LegSession {
  day: string;
  endMs: number;
  legSets: number;
  rpe: number | null;
}

export function legSessions(sessions: readonly StrengthSession[]): LegSession[] {
  return sessions
    .map((s) => {
      const legSets = s.sets.filter((x) => musclesOf(x.exercise, x.muscles).primary.some((m) => LEG_MUSCLES.includes(m))).length;
      // Ohne Startzeit: Mittag annehmen (Schätzung).
      const start = Date.parse(s.startTime ?? `${s.day}T12:00:00Z`);
      return { day: s.day, endMs: start + (s.durationMin ?? 60) * 60_000, legSets, rpe: s.rpe };
    })
    .filter((s) => s.legSets >= MIN_LEG_SETS)
    .sort((a, b) => a.endMs - b.endMs);
}

// --- Folgetag ----------------------------------------------------------------------------------

export type DayGroup = "afterLegs" | "afterRide" | "afterOther" | "afterRest";
export const DAY_GROUP_LABELS: Record<DayGroup, string> = {
  afterLegs: "Nach Beineinheit",
  afterRide: "Nach Radeinheit (ohne Beine)",
  afterOther: "Nach anderem Training",
  afterRest: "Nach Ruhetag",
};

export function nextDayEffects(series: readonly DayPoint[], workouts: readonly LoadedWorkout[], legs: readonly LegSession[], fromDay: string, today: string) {
  const legDays = new Set(legs.map((l) => l.day));
  const rideDays = new Set(workouts.filter((w) => isRide(w.sport)).map((w) => w.day));
  const byDay = new Map(series.map((p) => [p.day, p]));
  const groups = new Map<DayGroup, { recovery: number[]; hrv: number[] }>();
  for (const p of series) {
    if (p.day < fromDay || p.day > today) continue;
    const prev = byDay.get(addDays(p.day, -1));
    if (!prev) continue;
    const g: DayGroup = legDays.has(prev.day) ? "afterLegs" : rideDays.has(prev.day) ? "afterRide" : prev.workouts > 0 ? "afterOther" : "afterRest";
    const e = groups.get(g) ?? { recovery: [], hrv: [] };
    if (p.recovery != null) e.recovery.push(p.recovery);
    if (p.hrv != null) e.hrv.push(p.hrv);
    groups.set(g, e);
  }
  const all = [...groups.values()];
  const avgRecovery = mean(all.flatMap((g) => g.recovery)), avgHrv = mean(all.flatMap((g) => g.hrv));
  return {
    avgRecovery: round(avgRecovery, 0),
    avgHrv: round(avgHrv, 0),
    groups: (Object.keys(DAY_GROUP_LABELS) as DayGroup[]).map((g) => {
      const e = groups.get(g) ?? { recovery: [], hrv: [] };
      const r = mean(e.recovery), h = mean(e.hrv);
      return {
        group: g, label: DAY_GROUP_LABELS[g], days: e.recovery.length,
        recovery: round(r, 0), hrv: round(h, 0),
        recoveryVsAvg: r != null && avgRecovery != null && e.recovery.length >= MIN_GROUP ? round(r - avgRecovery, 1) : null,
        hrvVsAvgPct: h != null && avgHrv && e.hrv.length >= MIN_GROUP ? round(((h - avgHrv) / avgHrv) * 100, 1) : null,
      };
    }),
  };
}

// --- Nächste Radeinheit ---------------------------------------------------------------------------

export type GapBucket = "lt24" | "24to48" | "48to72" | "gt72" | "none";
export const GAP_LABELS: Record<GapBucket, string> = {
  lt24: "unter 24 h",
  "24to48": "24–48 h",
  "48to72": "48–72 h",
  gt72: "3–7 Tage",
  none: "ohne Beine (7 Tage)",
};
const bucketOf = (gapH: number | null): GapBucket => (gapH == null ? "none" : gapH < 24 ? "lt24" : gapH < 48 ? "24to48" : gapH < 72 ? "48to72" : "gt72");

export interface RideAfterLegs {
  day: string;
  source: string;
  sourceId: string;
  gapH: number | null;
  bucket: GapBucket;
  durationMin: number;
  intensity: number | null;
  hard: boolean;
  /** Effizienz-Faktor: (normierte) Leistung pro Herzschlag. */
  ef: number | null;
}

export function ridesAfterLegs(workouts: readonly LoadedWorkout[], legs: readonly LegSession[], fromDay: string): RideAfterLegs[] {
  return workouts
    .filter((w) => w.day >= fromDay && isRide(w.sport) && (w.duration_s ?? 0) >= 1200)
    .map((w) => {
      const start = Date.parse(w.start_time);
      const last = [...legs].reverse().find((l) => l.endMs <= start && start - l.endMs <= 7 * 24 * H);
      const gapH = last ? round((start - last.endMs) / H, 1) : null;
      const watts = w.normalized_power_w ?? w.avg_power_w;
      return {
        day: w.day, source: w.source, sourceId: w.source_id, gapH, bucket: bucketOf(gapH),
        durationMin: Math.round((w.duration_s ?? 0) / 60),
        intensity: round(w.intensity, 2),
        hard: (w.intensity ?? 0) >= HARD_IF,
        ef: watts && w.avg_hr ? round(watts / w.avg_hr, 2) : null,
      };
    })
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function rideEffects(rides: readonly RideAfterLegs[]) {
  // Effizienz nur zwischen ähnlich harten Fahrten vergleichen: je Fahrt relativ zum Median ihrer Klasse (locker/hart).
  const baseline = (hard: boolean) => median(rides.filter((r) => r.hard === hard && r.ef != null).map((r) => r.ef!));
  const base = { true: baseline(true), false: baseline(false) };
  const efPct = (r: RideAfterLegs) => {
    const b = base[String(r.hard) as "true" | "false"];
    return r.ef != null && b ? ((r.ef - b) / b) * 100 : null;
  };
  const hardIfMedian = median(rides.filter((r) => r.hard && r.intensity != null).map((r) => r.intensity!));
  return (Object.keys(GAP_LABELS) as GapBucket[]).map((bucket) => {
    const rs = rides.filter((r) => r.bucket === bucket);
    const efs = rs.map(efPct).filter((x): x is number => x != null);
    const hard = rs.filter((r) => r.hard && r.intensity != null);
    return {
      bucket, label: GAP_LABELS[bucket], rides: rs.length, hardRides: hard.length,
      efVsTypicalPct: efs.length >= MIN_GROUP ? round(mean(efs), 1) : null,
      hardIntensity: hard.length ? round(mean(hard.map((r) => r.intensity!)), 2) : null,
      hardIntensityVsTypical: hard.length >= MIN_GROUP && hardIfMedian ? round(mean(hard.map((r) => r.intensity!))! - hardIfMedian, 2) : null,
    };
  });
}

/**
 * Kleinster Abstand, ab dem die Effizienz nicht mehr spürbar (mehr als 2 %) unter dem eigenen Mittel liegt.
 * Nur mit genügend Fahrten in den Gruppen; sonst null mit Begründung.
 */
export function suggestGap(effects: ReturnType<typeof rideEffects>) {
  const ordered: GapBucket[] = ["lt24", "24to48", "48to72", "gt72"];
  const known = ordered.map((b) => effects.find((e) => e.bucket === b)!).filter((e) => e.efVsTypicalPct != null);
  if (known.length < 2) return { hours: null, text: "Noch zu wenige Radeinheiten mit Puls und Leistung in unterschiedlichem Abstand zu Beineinheiten für eine Aussage." };
  const hit = known.find((e) => e.efVsTypicalPct! >= -2 && (e.hardIntensityVsTypical == null || e.hardIntensityVsTypical >= -0.02));
  const hours: Record<GapBucket, number> = { lt24: 0, "24to48": 24, "48to72": 48, gt72: 72, none: 168 };
  if (!hit) return { hours: 72, text: "In deinen Daten liegt die Effizienz in allen Abständen bis 3 Tage nach Beinen etwas unter dem Mittel. Harte Intervalle eher mit mindestens 72 h Abstand planen (Beobachtung)." };
  const h = hours[hit.bucket];
  return {
    hours: h,
    text: h === 0
      ? "In deinen Daten fährst du auch am Tag nach Beinen ohne messbaren Effizienzverlust. Ein Abstand ist bei dir bisher nicht nötig (Beobachtung)."
      : `In deinen Daten ist die Radeinheit ab etwa ${h} h nach Beinen wieder so effizient wie sonst. Harte Intervalle daher mit mindestens ${h} h Abstand planen (Beobachtung, keine Ursache-Wirkung).`,
  };
}

export function interferenceReport(
  input: { series: readonly DayPoint[]; workouts: readonly LoadedWorkout[]; strength: readonly StrengthSession[] },
  today: string,
  days: number,
) {
  const from = addDays(today, -(days - 1));
  const legs = legSessions(input.strength);
  const rides = ridesAfterLegs(input.workouts, legs, from);
  const effects = rideEffects(rides);
  return {
    today,
    range: { from, to: today, days },
    legSessions: legs.filter((l) => l.day >= from).length,
    nextDay: nextDayEffects(input.series, input.workouts, legs.filter((l) => l.day >= addDays(from, -1)), from, today),
    nextRide: effects,
    suggestion: suggestGap(effects),
    recentRides: rides.filter((r) => r.gapH != null).slice(-10),
    notes: [
      `Beineinheit = Krafteinheit mit mindestens ${MIN_LEG_SETS} Beinsätzen (Quadrizeps, Beinbizeps, Gesäß). Ohne Startzeit wird Mittag angenommen.`,
      "Effizienz = (normierte) Leistung pro Herzschlag, verglichen mit ähnlich harten Fahrten (locker bzw. ab IF 0,85). Puls und Leistung kommen oft aus zwei Geräten.",
      `Gruppen mit weniger als ${MIN_GROUP} Fällen werden nicht verglichen. Beobachtungen aus deinen Daten, keine Ursache-Wirkung und keine Diagnose.`,
    ],
  };
}
