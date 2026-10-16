// Beste Trainingszeit (#131): Tageszeit des Trainings gegen Effizienz auf dem Rad, Schlaf der folgenden Nacht und
// Erholung am nächsten Morgen. Beobachtungen aus den eigenen Daten, keine Ursache-Wirkung. Reine Funktionen ohne D1.
import { addDays, type DayPoint, type MergedWorkout, type WorkoutLoad } from "./analysis";
import { localMinutes } from "./performance";
import { isRide } from "./records";

type LoadedWorkout = MergedWorkout & WorkoutLoad;

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type Slot = "morning" | "midday" | "afternoon" | "evening" | "late";
export const SLOTS: Slot[] = ["morning", "midday", "afternoon", "evening", "late"];
export const SLOT_LABELS: Record<Slot, string> = {
  morning: "morgens (bis 10 Uhr)",
  midday: "mittags (10–14 Uhr)",
  afternoon: "nachmittags (14–18 Uhr)",
  evening: "abends (18–21 Uhr)",
  late: "spät (ab 21 Uhr)",
};
/** Mindestanzahl je Zeitfenster für einen Vergleich. */
export const MIN_N = 3;
const HARD_IF = 0.85;

export function slotOf(minutes: number): Slot {
  return minutes < 600 ? "morning" : minutes < 840 ? "midday" : minutes < 1080 ? "afternoon" : minutes < 1260 ? "evening" : "late";
}

export function timingReport(series: readonly DayPoint[], workouts: readonly LoadedWorkout[], timeZone: string, today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const inRange = workouts.filter((w) => w.day >= from && w.day <= today && (w.duration_s ?? 0) >= 900);
  const startSlot = (w: LoadedWorkout) => {
    const m = localMinutes(w.start_time, timeZone);
    return m == null ? null : slotOf(m);
  };

  // Effizienz der Radeinheiten je Startzeit, relativ zum Median ähnlich harter Fahrten.
  const rides = inRange
    .filter((w) => isRide(w.sport) && w.avg_hr && (w.normalized_power_w ?? w.avg_power_w))
    .map((w) => ({ slot: startSlot(w), hard: (w.intensity ?? 0) >= HARD_IF, ef: (w.normalized_power_w ?? w.avg_power_w)! / w.avg_hr! }));
  // Mittel statt Median: bei zwei Zeitfenstern mit je ähnlich vielen Fahrten läge der Median auf einem der beiden.
  const base = { true: mean(rides.filter((r) => r.hard).map((r) => r.ef)), false: mean(rides.filter((r) => !r.hard).map((r) => r.ef)) };
  const efPct = (r: (typeof rides)[number]) => {
    const b = base[String(r.hard) as "true" | "false"];
    return b ? ((r.ef - b) / b) * 100 : null;
  };

  // Folgende Nacht und nächster Morgen: je Tag zählt das zuletzt endende Training.
  const lastByDay = new Map<string, LoadedWorkout>();
  for (const w of inRange) {
    const cur = lastByDay.get(w.day);
    if (!cur || w.end_time > cur.end_time) lastByDay.set(w.day, w);
  }
  const byDay = new Map(series.map((p) => [p.day, p]));
  const nights = series.filter((p) => p.day > from && p.day <= today);
  const avg = {
    sleepH: mean(nights.flatMap((p) => (p.sleepH != null ? [p.sleepH] : []))),
    sleepPerf: mean(nights.flatMap((p) => (p.sleepPerf != null ? [p.sleepPerf] : []))),
    recovery: mean(nights.flatMap((p) => (p.recovery != null ? [p.recovery] : []))),
  };
  const after = new Map<Slot, { sleepH: number[]; sleepPerf: number[]; recovery: number[] }>();
  for (const [day, w] of lastByDay) {
    const m = localMinutes(w.end_time, timeZone);
    const next = byDay.get(addDays(day, 1));
    if (m == null || !next) continue;
    const e = after.get(slotOf(m)) ?? { sleepH: [], sleepPerf: [], recovery: [] };
    if (next.sleepH != null) e.sleepH.push(next.sleepH);
    if (next.sleepPerf != null) e.sleepPerf.push(next.sleepPerf);
    if (next.recovery != null) e.recovery.push(next.recovery);
    after.set(slotOf(m), e);
  }

  const diff = (xs: number[] | undefined, ref: number | null, digits: number) => {
    const m = xs && xs.length >= MIN_N ? mean(xs) : null;
    return m != null && ref != null ? round(m - ref, digits) : null;
  };
  const slots = SLOTS.map((slot) => {
    const sessions = inRange.filter((w) => startSlot(w) === slot).length;
    const efs = rides.filter((r) => r.slot === slot).map(efPct).filter((x): x is number => x != null);
    const a = after.get(slot);
    return {
      slot, label: SLOT_LABELS[slot], sessions,
      rides: efs.length,
      efVsTypicalPct: efs.length >= MIN_N ? round(mean(efs), 1) : null,
      /** Nächte nach Training, das in diesem Fenster endete. */
      nights: a?.sleepH.length ?? 0,
      sleepVsAvgMin: (() => { const d = diff(a?.sleepH, avg.sleepH, 2); return d == null ? null : Math.round(d * 60); })(),
      sleepPerfVsAvg: diff(a?.sleepPerf, avg.sleepPerf, 1),
      recoveryVsAvg: diff(a?.recovery, avg.recovery, 1),
    };
  });

  const withEf = slots.filter((s) => s.efVsTypicalPct != null);
  const best = withEf.length >= 2 ? withEf.reduce((a, b) => (b.efVsTypicalPct! > a.efVsTypicalPct! ? b : a)) : null;
  const costly = slots.filter((s) => (s.slot === "evening" || s.slot === "late") && ((s.sleepVsAvgMin ?? 0) <= -20 || (s.recoveryVsAvg ?? 0) <= -5));
  const hints: string[] = [];
  if (best && best.efVsTypicalPct! >= 1) hints.push(`Am effizientesten fährst du ${best.label}: ${String(best.efVsTypicalPct).replace(".", ",")} % mehr Watt je Herzschlag als üblich. Harte Einheiten möglichst dorthin legen.`);
  for (const s of costly) {
    const parts = [
      s.sleepVsAvgMin != null && s.sleepVsAvgMin <= -20 ? `${Math.abs(s.sleepVsAvgMin)} min weniger Schlaf` : null,
      s.recoveryVsAvg != null && s.recoveryVsAvg <= -5 ? `${String(Math.abs(s.recoveryVsAvg)).replace(".", ",")} Punkte weniger Erholung` : null,
    ].filter(Boolean);
    hints.push(`Nach Training ${s.label} hast du im Schnitt ${parts.join(" und ")} als sonst. Harte Einheiten dann früher beenden oder locker halten.`);
  }
  if (!hints.length)
    hints.push(withEf.length >= 2 || slots.some((s) => s.recoveryVsAvg != null)
      ? "Keine deutlichen Unterschiede zwischen den Tageszeiten: trainiere, wann es dir am besten passt."
      : "Noch zu wenige Einheiten in verschiedenen Zeitfenstern für eine Aussage.");

  return {
    today,
    range: { from, to: today, days },
    timeZone,
    sessions: inRange.length,
    averages: { sleepH: round(avg.sleepH, 2), sleepPerf: round(avg.sleepPerf, 0), recovery: round(avg.recovery, 0) },
    slots,
    hints,
    notes: [
      "Zeitfenster nach Startzeit (Effizienz) bzw. Endzeit des letzten Trainings am Tag (Schlaf und Erholung danach), in deiner Zeitzone. Einheiten ab 15 min.",
      "Effizienz = (normierte) Leistung je Herzschlag gegenüber ähnlich harten Fahrten. Schlaf und Erholung gegenüber deinem Mittel aller Nächte im Zeitraum.",
      `Erst ab ${MIN_N} Fällen je Zeitfenster verglichen. Beobachtungen aus deinen Daten, keine Ursache-Wirkung.`,
    ],
  };
}
