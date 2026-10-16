import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { DEFAULT_PREFS, buildWeekPlan, type Goal } from "../src/core/plan";
import { formZone, projectEvent, type ProjectionInput } from "../src/core/projection";

// Synthetische Werte.
const TODAY = "2026-03-04"; // Mittwoch
const goal = (o: Partial<Goal>): Goal => ({
  id: 7, kind: "event", title: "Radmarathon", targetDate: null, metric: null, targetValue: null, unit: null, sport: "cycling",
  priority: "A", status: "active", notes: null, createdAt: "", updatedAt: "", ...o,
});
const input = (o: Partial<ProjectionInput> = {}): ProjectionInput => ({
  today: TODAY, ctl: 45, atl: 45, todayLoad: 0, goals: [], prefs: { ...DEFAULT_PREFS, weeklyHours: 8, strengthPerWeek: 0 }, weeks: [],
  currentPlan: null, ftpW: 250, thresholdHr: 165, maxHr: 185, ...o,
});

describe("Formprognose", () => {
  it("ohne Termin gibt es keine Prognose", () => {
    expect(projectEvent(input())).toBeNull();
    expect(projectEvent(input({ goals: [goal({ targetDate: addDays(TODAY, -1) })] }))).toBeNull();
  });

  it("rechnet bis zum Termin mit Aufbau, Spitze, Tapering und kommt frisch an", () => {
    const g = goal({ targetDate: addDays(TODAY, 66) }); // Sonntag in gut 9 Wochen
    const currentPlan = buildWeekPlan({ ...input(), weekStart: TODAY, goals: [g], tsb: 0 });
    const p = projectEvent(input({ goals: [g], currentPlan }))!;
    expect(p.daysLeft).toBe(66);
    expect(p.days.at(-1)!.day).toBe(g.targetDate);
    const phases = p.weeks.map((w) => w.phase);
    expect(phases).toContain("build");
    expect(phases.at(-1)).toBe("race");
    expect(phases.at(-2)).toBe("taper");
    expect(p.atEvent.ctlGain).toBeGreaterThan(0);
    expect(p.atEvent.tsb).toBeGreaterThan(0);
    expect(["on_track", "too_fresh", "too_tired"]).toContain(p.verdict);
    expect(p.advice.length).toBeGreaterThan(0);
  });

  it("zählt die heute schon trainierte Belastung, wenn sie über dem Plan liegt", () => {
    const g = goal({ targetDate: addDays(TODAY, 20) });
    const lazy = projectEvent(input({ goals: [g], todayLoad: 0 }))!;
    const hard = projectEvent(input({ goals: [g], todayLoad: 150 }))!;
    expect(hard.days[0].load).toBe(150);
    expect(hard.days[0].ctl).toBeGreaterThan(lazy.days[0].ctl);
  });

  it("warnt bei weniger als einer Woche und begrenzt weit entfernte Termine", () => {
    expect(projectEvent(input({ goals: [goal({ targetDate: addDays(TODAY, 3) })] }))!.verdict).toBe("short");
    const far = projectEvent(input({ goals: [goal({ targetDate: addDays(TODAY, 400) })] }))!;
    expect(far.days.length).toBeLessThanOrEqual(26 * 7);
    expect(far.advice[0]).toContain("26 Wochen");
  });

  it("ordnet die Form in Bereiche ein", () => {
    expect([formZone(-35), formZone(-20), formZone(0), formZone(15), formZone(30)]).toEqual(["overreaching", "productive", "maintaining", "fresh", "detraining"]);
  });
});
