import { describe, expect, it } from "vitest";
import type { CoachAdvice } from "../src/core/coach";
import type { PlannedSession, SessionType, WeekPlan } from "../src/core/plan";
import { ftpTestPlan, type TrainingInputs } from "../src/core/training";

const coach = { day: "2026-03-24", readiness: "moderate", score: 80, headline: "", suggestion: "", targetLoad: null, reasons: [], warnings: [], disclaimer: "" } as CoachAdvice;
const input = (ftpW: number | null = null): TrainingInputs => ({
  today: "2026-03-24",
  days: [{ day: "2026-03-24", tsb: 5 } as TrainingInputs["days"][number]],
  weeks: [],
  coach,
  settings: { ftpW, thresholdHr: 170, maxHr: 190 },
  workouts: [],
});
const s = (day: string, type: SessionType, title: string, strength: PlannedSession["strength"] = null): PlannedSession =>
  ({ day, type, title, durationMin: 60, targetLoad: 50, intensity: "", description: "", key: false, strength });
// Mo 23.3. – So 29.3.; heute ist Dienstag.
const plan = (days: PlannedSession[]): WeekPlan => ({ weekStart: "2026-03-23", phase: "build", phaseReason: "", goalId: null, targetLoad: 300, targetHours: 6, days, notes: [], source: "rule" });
const week = plan([
  s("2026-03-23", "threshold", "Schwelle Mo"),
  s("2026-03-24", "endurance", "Grundlage Di"),
  s("2026-03-25", "rest", "Ruhetag"),
  s("2026-03-26", "threshold", "Schwelle Do"),
  s("2026-03-27", "endurance", "Grundlage Fr", { durationMin: 30, focus: "Beine" }),
  s("2026-03-28", "tempo", "Tempo Sa"),
  s("2026-03-29", "long", "Lange Fahrt"),
]);

describe("ftpTestPlan", () => {
  it("ersetzt bei fälligem Test die erste harte Einheit ab heute nach einem ruhigen Vortag", () => {
    const r = ftpTestPlan(input(), week, null)!;
    expect(r.due).toBe(true);
    expect(r.rested).toBe(true);
    // Mo liegt in der Vergangenheit, Sa folgt auf Beinkraft: Do (nach dem Ruhetag) ist richtig.
    expect(r.day).toBe("2026-03-26");
    expect(r.replaces).toBe("Schwelle Do");
    expect(r.text).toContain("Ramp-Test");
    expect(r.text).toContain("Wattbereiche");
  });
  it("null, solange der letzte Test keine 6 Wochen her ist", () => {
    expect(ftpTestPlan(input(250), week, "2026-03-01")).toBeNull();
  });
  it("nach 6 Wochen wieder fällig, ohne Watt-Hinweis bei bekannter FTP", () => {
    const r = ftpTestPlan(input(250), week, "2026-02-01")!;
    expect(r.day).toBe("2026-03-26");
    expect(r.text).not.toContain("Wattbereiche");
  });
  it("ohne passenden Tag: Hinweis auf nächste Woche", () => {
    const r = ftpTestPlan(input(), plan(week.days.map((d) => (d.day >= "2026-03-24" ? { ...d, type: "rest" as SessionType } : d))), null)!;
    expect(r.day).toBeNull();
    expect(r.text).toContain("Nächste Woche");
  });
  it("ohne passenden Tag diese Woche: Vorschlag aus dem Plan der nächsten Woche", () => {
    const rest = plan(week.days.map((d) => (d.day >= "2026-03-24" ? { ...d, type: "rest" as SessionType } : d)));
    const next = { ...plan([s("2026-03-30", "rest", "Ruhetag"), s("2026-03-31", "endurance", "Grundlage"), s("2026-04-01", "threshold", "Schwelle Mi")]), weekStart: "2026-03-30" };
    const r = ftpTestPlan(input(), rest, null, next)!;
    expect(r.day).toBe("2026-04-01");
    expect(r.text).toContain("nächste Woche Mittwoch statt „Schwelle Mi“");
  });
});
