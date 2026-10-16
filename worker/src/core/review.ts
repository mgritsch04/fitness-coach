// Wochenrückblick (#76): Kennzahlen einer Woche gegen die Vorwoche, Soll/Ist aus dem Plan, Highlights
// und 2–3 regelbasierte Punkte für die nächste Woche. Claude formuliert daraus im Artefakt den Text.
// Trainingsempfehlungen, keine Diagnose; Belastung und Fitness sind Schätzungen.
import { addDays, weekStart, type DayPoint, type WeekSummary } from "./analysis";
import type { JournalEntry } from "./journal";
import { isStrengthSport, type PlanComparison } from "./plan";

export interface ReviewWorkout {
  day: string;
  sport: string | null;
  durationMin: number;
  load: number | null;
  distanceKm?: number | null;
  avgHr?: number | null;
  hrZoneMin?: number[] | null;
}

export interface ReviewInput {
  week: string;
  today: string;
  days: DayPoint[];
  weeks: WeekSummary[];
  workouts: ReviewWorkout[];
  comparison: PlanComparison | null;
  journal: JournalEntry[];
  strengthSessions?: { day: string; sets: number }[];
}

type Num = number | null;
interface Compare { value: Num; previous: Num; delta: Num }

export interface WeekReview {
  week: string;
  /** false, solange die Woche noch läuft. */
  complete: boolean;
  totals: { workouts: number; hours: number; load: number; distanceKm: number; strengthSessions: number; restDays: number };
  bySport: { sport: string; count: number; minutes: number }[];
  fitness: { ctlStart: Num; ctlEnd: Num; ctlChange: Num; tsbEnd: Num };
  vsPrevious: { hours: Compare; load: Compare; recovery: Compare; hrv: Compare; rhr: Compare; sleepH: Compare };
  /** Anteile locker (WHOOP-Zone 1–3), mittel (4), hart (5) an der Zeit ab Zone 1. */
  intensity: { easyPct: number; moderatePct: number; hardPct: number } | null;
  plan: { compliancePct: number | null; sessionsDone: number; sessionsPlanned: number; keyMissed: string[]; summary: string } | null;
  highlights: string[];
  journal: { entries: number; avgFeeling: Num; avgEnergy: Num; avgSoreness: Num; tags: { tag: string; count: number }[] };
  nextWeek: string[];
  disclaimer: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const avg = (xs: Num[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const cmp = (value: Num, previous: Num): Compare => ({ value, previous, delta: value != null && previous != null ? r1(value - previous) : null });
const de = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

const SPORT_LABEL: Record<string, string> = { cycling: "Rad", spin: "Rolle/Spinning", bodybuilding: "Kraft", weightlifting: "Kraft", running: "Laufen", walking: "Gehen" };
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
/** „Do 26.3.“ */
const fmtDay = (day: string) => {
  const d = new Date(day + "T00:00:00Z");
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
};
const label = (s: string | null) => (s ? SPORT_LABEL[s] ?? s : "ohne Sportart");

export function weekReview(inp: ReviewInput): WeekReview {
  const ws = weekStart(inp.week);
  const we = addDays(ws, 6);
  const prevWs = addDays(ws, -7);
  const inWeek = <T extends { day: string }>(xs: T[], from = ws, to = we) => xs.filter((x) => x.day >= from && x.day <= to);

  const days = inWeek(inp.days);
  const prevDays = inWeek(inp.days, prevWs, addDays(ws, -1));
  const workouts = inWeek(inp.workouts);
  const sum = inp.weeks.find((w) => w.week === ws) ?? null;
  const prev = inp.weeks.find((w) => w.week === prevWs) ?? null;

  const minutes = workouts.reduce((a, w) => a + w.durationMin, 0);
  const load = r1(workouts.reduce((a, w) => a + (w.load ?? 0), 0));
  const sports = new Map<string, { count: number; minutes: number }>();
  for (const w of workouts) {
    const k = w.sport ?? "unbekannt";
    const s = sports.get(k) ?? { count: 0, minutes: 0 };
    s.count++; s.minutes += w.durationMin;
    sports.set(k, s);
  }
  const strengthSessions = inp.strengthSessions ? inWeek(inp.strengthSessions).length || workouts.filter((w) => isStrengthSport(w.sport)).length : workouts.filter((w) => isStrengthSport(w.sport)).length;
  const lastDay = we < inp.today ? we : inp.today;
  const elapsed = days.filter((d) => d.day <= lastDay);
  const restDays = elapsed.filter((d) => !d.workouts).length;

  // Pulszonen der Woche (ohne Zone 0, z. B. Pausen im Kraftraum).
  const zones = [0, 0, 0, 0, 0, 0];
  for (const w of workouts) w.hrZoneMin?.forEach((m, i) => (zones[i] += m));
  const zTotal = zones.slice(1).reduce((a, b) => a + b, 0);
  const intensity = zTotal > 0
    ? { easyPct: r1(((zones[1] + zones[2] + zones[3]) / zTotal) * 100), moderatePct: r1((zones[4] / zTotal) * 100), hardPct: r1((zones[5] / zTotal) * 100) }
    : null;

  const ctlStart = prevDays.at(-1)?.ctl ?? null;
  const endPoint = elapsed.at(-1) ?? null;
  const fitness = {
    ctlStart,
    ctlEnd: endPoint?.ctl ?? null,
    ctlChange: ctlStart != null && endPoint ? r1(endPoint.ctl - ctlStart) : null,
    tsbEnd: endPoint?.tsb ?? null,
  };

  const c = inp.comparison;
  const plan = c
    ? {
        compliancePct: c.compliancePct,
        sessionsDone: c.sessionsDoneToDate,
        sessionsPlanned: c.sessionsPlannedToDate,
        keyMissed: c.keySessionsMissed,
        summary: c.summary,
      }
    : null;

  // Highlights: längste und härteste Einheit, beste Erholung, längster Schlaf.
  const highlights: string[] = [];
  const cardio = workouts.filter((w) => !isStrengthSport(w.sport));
  const longest = [...cardio].sort((a, b) => b.durationMin - a.durationMin)[0];
  if (longest) highlights.push(`Längste Einheit: ${label(longest.sport)} am ${fmtDay(longest.day)}, ${Math.round(longest.durationMin)} min${longest.distanceKm ? `, ${de(longest.distanceKm)} km` : ""}.`);
  const hardest = [...workouts].sort((a, b) => (b.load ?? 0) - (a.load ?? 0))[0];
  if (hardest && hardest !== longest && (hardest.load ?? 0) > 0) highlights.push(`Härteste Einheit: ${label(hardest.sport)} am ${fmtDay(hardest.day)}, Belastung ${Math.round(hardest.load!)} (geschätzt).`);
  const bestRec = [...days].filter((d) => d.recovery != null).sort((a, b) => b.recovery! - a.recovery!)[0];
  if (bestRec) highlights.push(`Beste Erholung: ${bestRec.recovery} % am ${fmtDay(bestRec.day)}`);
  if (sum?.sleepDebtH != null && sum.sleepDebtH <= 0) highlights.push("Schlafbedarf im Schnitt gedeckt.");

  // Tagebuch
  const j = inWeek(inp.journal);
  const tagCount = new Map<string, number>();
  for (const e of j) for (const t of e.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const journal = {
    entries: j.length,
    avgFeeling: avg(j.map((e) => e.feeling)),
    avgEnergy: avg(j.map((e) => e.energy)),
    avgSoreness: avg(j.map((e) => e.soreness)),
    tags: [...tagCount].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  };

  const vsPrevious = {
    hours: cmp(r1(minutes / 60), prev ? r1(prev.trainingH) : null),
    load: cmp(load, prev ? r1(prev.load) : null),
    recovery: cmp(sum?.avgRecovery ?? avg(days.map((d) => d.recovery)), prev?.avgRecovery ?? null),
    hrv: cmp(sum?.avgHrv ?? avg(days.map((d) => d.hrv)), prev?.avgHrv ?? null),
    rhr: cmp(sum?.avgRhr ?? avg(days.map((d) => d.rhr)), prev?.avgRhr ?? null),
    sleepH: cmp(sum?.avgSleepH ?? avg(days.map((d) => d.sleepH)), prev?.avgSleepH ?? null),
  };

  // Regelbasierte Punkte für die nächste Woche (höchstens drei, wichtigste zuerst).
  const next: string[] = [];
  if (elapsed.length >= 7 && restDays === 0) next.push("Kein Ruhetag diese Woche: nächste Woche mindestens einen Tag ganz frei oder nur Spaziergang.");
  if (sum?.sleepDebtH != null && sum.sleepDebtH >= 3) next.push(`Etwa ${de(sum.sleepDebtH)} h Schlafschuld: früher ins Bett, vor allem vor harten Tagen.`);
  if (vsPrevious.load.previous && vsPrevious.load.value != null && vsPrevious.load.value > vsPrevious.load.previous * 1.3)
    next.push("Belastung über 30 % höher als in der Vorwoche: nächste Woche nicht weiter steigern.");
  if (vsPrevious.hrv.delta != null && vsPrevious.hrv.previous && vsPrevious.hrv.delta / vsPrevious.hrv.previous <= -0.1)
    next.push("HRV deutlich unter der Vorwoche: Intensität etwas zurücknehmen und auf Erholung achten.");
  if (intensity && intensity.easyPct >= 95 && zTotal >= 180) next.push("Fast alles war locker: eine gezielte zügige Einheit (Tempo oder Intervalle) setzt einen neuen Reiz.");
  if (plan?.keyMissed.length) next.push(`Verpasste Schlüsseleinheit (${plan.keyMissed[0]}) nicht nachholen, sondern im neuen Plan neu einplanen.`);
  if (!next.length) next.push("Gute Woche: so weitermachen und die Belastung höchstens leicht steigern.");

  return {
    week: ws,
    complete: we < inp.today,
    totals: { workouts: workouts.length, hours: r1(minutes / 60), load, distanceKm: r1(workouts.reduce((a, w) => a + (w.distanceKm ?? 0), 0)), strengthSessions, restDays },
    bySport: [...sports].map(([sport, v]) => ({ sport, ...v })).sort((a, b) => b.minutes - a.minutes),
    fitness,
    vsPrevious,
    intensity,
    plan,
    highlights,
    journal,
    nextWeek: next.slice(0, 3),
    disclaimer: "Rückblick aus deinen Daten. Belastung und Fitness sind Schätzungen; Trainingshinweise, keine medizinische Beratung.",
  };
}
