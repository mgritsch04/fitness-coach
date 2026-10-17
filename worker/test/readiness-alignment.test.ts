import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import { readinessAlignment, verdictOf } from "../src/core/readiness-alignment";
import { analysisHighlights } from "../src/core/highlights";

// Synthetische Tageswerte, keine echten Messwerte.
const TODAY = "2026-04-30";
const point = (day: string, p: Partial<DayPoint>): DayPoint => ({
  day, recovery: 60, hrv: 60, rhr: 52, spo2: null, skinTemp: null, strain: 8, sleepH: 7.5, sleepPerf: 85, sleepEff: 90, deepH: 1.5, remH: 1.8, respRate: 15,
  load: 50, ctl: 50, atl: 50, tsb: 0, workouts: 1, trainingMin: 60, ...p,
});
/** 60 Tage im Wechsel grün / gelb / rot; `pick` liefert Strain und Erholung je Zone. */
function series(pick: (zone: number, i: number) => Partial<DayPoint>) {
  return Array.from({ length: 60 }, (_, i) => point(addDays(TODAY, -59 + i), pick(i % 3, i)));
}
const rec = [80, 50, 25];

describe("Training nach der Erholungsampel", () => {
  it("Bewertung je Zone und Strain", () => {
    expect(verdictOf("red", "hard")).toBe("against");
    expect(verdictOf("red", "light")).toBe("aligned");
    expect(verdictOf("green", "light")).toBe("missed");
    expect(verdictOf("green", "moderate")).toBe("aligned");
    expect(verdictOf("yellow", "hard")).toBe("neutral");
  });

  it("passendes Training: hohe Quote, Lob", () => {
    const r = readinessAlignment(series((z) => ({ recovery: rec[z], strain: [16, 11, 5][z] })), TODAY, 60);
    if (!r.available) throw new Error(r.reason);
    expect(r.days).toBe(59);
    expect(r.score).toBe(100);
    expect(r.counts.against).toBe(0);
    expect(r.hardOnGreenPct).toBe(100);
    expect(r.hints[0]).toMatch(/gut nach der Erholung/);
    expect(r.matrix[0].counts.hard).toBe(r.matrix[0].total);
    expect(r.recent).toHaveLength(14);
  });

  it("hart an roten Tagen: Hinweis mit Kosten am Morgen danach", () => {
    // Rote Tage abwechselnd hart und ruhig; nach hartem rotem Tag ist die Erholung am Morgen danach niedriger.
    const s = series((z, i) => {
      const prevRedHard = (i - 1) % 3 === 2 && (i - 1) % 6 === 2;
      return { recovery: z === 0 && prevRedHard ? 67 : z === 0 ? 85 : rec[z], strain: z === 2 ? (i % 6 === 2 ? 16 : 5) : z === 0 ? 7 : 11 };
    });
    const r = readinessAlignment(s, TODAY, 60);
    if (!r.available) throw new Error(r.reason);
    expect(r.counts.against).toBeGreaterThan(0);
    expect(r.redCost).toBe(18);
    expect(r.hints[0]).toMatch(/roten Tagen hast du trotzdem hart trainiert.*18 Punkte tiefer/);
    expect(r.hints.some((h) => h.includes("grünen Tage"))).toBe(true);
    const h = analysisHighlights({ readiness: r });
    expect(h.highlights[0]).toMatchObject({ topic: "readiness", tone: "warn", tool: "get_readiness_alignment" });
  });

  it("zu wenige Tage", () => {
    const s = series((z) => ({ recovery: rec[z] })).slice(-10);
    const r = readinessAlignment(s, TODAY, 60);
    expect(r.available).toBe(false);
    expect(analysisHighlights({ readiness: r }).highlights).toHaveLength(0);
  });
});
