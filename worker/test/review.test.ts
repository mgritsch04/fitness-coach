import { describe, expect, it } from "vitest";
import type { DayPoint, WeekSummary } from "../src/core/analysis";
import { weekReview, type ReviewWorkout } from "../src/core/review";

// Synthetische Wochen: Vorwoche 2026-03-02, Woche 2026-03-09, heute 2026-03-17.
const day = (d: string, o: Partial<DayPoint> = {}): DayPoint =>
  ({ day: d, recovery: 60, hrv: 70, rhr: 50, spo2: null, skinTemp: null, strain: 10, sleepH: 7.5, sleepPerf: null, sleepEff: null, deepH: null, remH: null, respRate: null, load: 40, ctl: 40, atl: 40, tsb: 0, workouts: 1, trainingMin: 60, ...o }) as DayPoint;
const dates = (start: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(start + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10));
const week = (w: string, o: Partial<WeekSummary> = {}): WeekSummary => ({ week: w, workouts: 7, trainingH: 7, load: 280, distanceKm: 0, bySport: {}, avgRecovery: 60, avgHrv: 70, avgRhr: 50, avgSleepH: 7.5, avgStrain: 10, sleepDebtH: 1, ctlEnd: 40, ctlChange: 0, ...o });

const base = (o: { days?: DayPoint[]; weeks?: WeekSummary[]; workouts?: ReviewWorkout[] } = {}) => ({
  week: "2026-03-09",
  today: "2026-03-17",
  days: o.days ?? [...dates("2026-03-02", 7).map((d) => day(d)), ...dates("2026-03-09", 7).map((d, i) => day(d, { ctl: 40 + i, hrv: 60, workouts: i === 3 ? 0 : 1 }))],
  weeks: o.weeks ?? [week("2026-03-02"), week("2026-03-09", { avgHrv: 60, sleepDebtH: 4 })],
  workouts: o.workouts ?? [
    { day: "2026-03-10", sport: "cycling", durationMin: 120, load: 90, distanceKm: 60, hrZoneMin: [0, 60, 50, 10, 0, 0] },
    { day: "2026-03-12", sport: "cycling", durationMin: 60, load: 110, hrZoneMin: [0, 10, 10, 10, 20, 10] },
    { day: "2026-03-13", sport: "bodybuilding", durationMin: 45, load: 30 },
  ],
  comparison: null,
  journal: [{ day: "2026-03-10", feeling: 4, energy: 3, soreness: 2, stress: 2, motivation: 4, notes: null, tags: ["alkohol"] }],
});

describe("weekReview", () => {
  it("rechnet Summen, Fitnessänderung, Zonen und Highlights", () => {
    const r = weekReview(base());
    expect(r.complete).toBe(true);
    expect(r.totals).toMatchObject({ workouts: 3, hours: 3.8, load: 230, distanceKm: 60, strengthSessions: 1, restDays: 1 });
    expect(r.fitness).toMatchObject({ ctlStart: 40, ctlEnd: 46, ctlChange: 6 });
    expect(r.intensity).toEqual({ easyPct: 83.3, moderatePct: 11.1, hardPct: 5.6 });
    expect(r.highlights[0]).toBe("Längste Einheit: Rad am Di 10.3., 120 min, 60,0 km.");
    expect(r.highlights[1]).toContain("Härteste Einheit");
    expect(r.vsPrevious.hrv).toEqual({ value: 60, previous: 70, delta: -10 });
    expect(r.journal).toMatchObject({ entries: 1, avgFeeling: 4, tags: [{ tag: "alkohol", count: 1 }] });
  });

  it("gibt Hinweise für die nächste Woche (höchstens drei)", () => {
    const r = weekReview(base());
    expect(r.nextWeek.join(" ")).toContain("Schlafschuld");
    expect(r.nextWeek.join(" ")).toContain("HRV");
    expect(r.nextWeek.length).toBeLessThanOrEqual(3);
  });

  it("warnt bei fehlendem Ruhetag und zu viel nur lockerem Training", () => {
    const days = [...dates("2026-03-02", 7).map((d) => day(d)), ...dates("2026-03-09", 7).map((d) => day(d))];
    const workouts = dates("2026-03-09", 7).map((d) => ({ day: d, sport: "spin", durationMin: 60, load: 30, hrZoneMin: [0, 30, 30, 0, 0, 0] }));
    const r = weekReview(base({ days, workouts, weeks: [week("2026-03-02"), week("2026-03-09")] }));
    expect(r.nextWeek[0]).toContain("Kein Ruhetag");
    expect(r.nextWeek.join(" ")).toContain("zügige Einheit");
  });

  it("laufende Woche ist nicht abgeschlossen", () => {
    expect(weekReview({ ...base(), week: "2026-03-16" }).complete).toBe(false);
  });
});
