import { describe, expect, it } from "vitest";
import { actualBuckets, zoneTargets } from "../src/core/zone-targets";

// Synthetischer Wochenplan, keine echten Messwerte.
const plan = {
  weekStart: "2026-04-27",
  days: [
    { day: "2026-04-27", type: "rest" as const, durationMin: 0 },
    { day: "2026-04-28", type: "threshold" as const, durationMin: 60 },
    { day: "2026-04-29", type: "endurance" as const, durationMin: 80 },
    { day: "2026-04-30", type: "strength" as const, durationMin: 50 },
    { day: "2026-05-01", type: "vo2max" as const, durationMin: 60 },
    { day: "2026-05-03", type: "long" as const, durationMin: 180 },
  ],
};
const zones = (m: number[]) => ({ minutes: m });

describe("Zeit-in-Zone-Ziele", () => {
  it("Soll aus dem Plan, Kraft und Ruhe zählen nicht", () => {
    const r = zoneTargets(plan, null, "2026-04-29");
    expect(r.target).toMatchObject({ easy: 36 + 76 + 39 + 162, moderate: 18 + 4 + 6 + 18, hard: 6 + 15 });
    expect(r.rows[0].targetSoFarMin).toBe(36 + 76);
    expect(r.rows[0].actualMin).toBeNull();
    expect(r.hints[0]).toMatch(/noch keine Pulszonen/);
  });

  it("zu viel im mittleren Bereich", () => {
    // Bis Mittwoch: geplant 112 locker, 22 mittel, 6 hart; gefahren viel Zone 4.
    const r = zoneTargets(plan, zones([10, 20, 30, 30, 60, 5]), "2026-04-29");
    expect(actualBuckets(zones([10, 20, 30, 30, 60, 5]))).toEqual({ easy: 80, moderate: 60, hard: 5 });
    expect(r.hints[0]).toMatch(/60 min im mittleren Bereich.*etwa 22/);
  });

  it("passt zum Plan", () => {
    const r = zoneTargets(plan, zones([5, 30, 50, 30, 22, 6]), "2026-04-29");
    expect(r.hints).toEqual(["Die Verteilung locker / mittel / hart passt bisher zum Plan."]);
    expect(r.target.easyPct + r.target.moderatePct + r.target.hardPct).toBeGreaterThanOrEqual(99);
  });

  it("keine Ausdauer geplant", () => {
    const r = zoneTargets({ weekStart: "2026-04-27", days: [{ day: "2026-04-28", type: "strength", durationMin: 60 }] }, zones([0, 0, 0, 0, 0, 0]), "2026-04-29");
    expect(r.target.totalMin).toBe(0);
    expect(r.hints[0]).toMatch(/keine Ausdauereinheiten/);
  });
});
