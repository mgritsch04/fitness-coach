import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import { recoveryCurve } from "../src/core/recovery-curve";

// Synthetische Tageswerte, keine echten Messwerte.
const TODAY = "2026-04-30";
const point = (day: string, p: Partial<DayPoint>): DayPoint => ({
  day, recovery: 60, hrv: 60, rhr: 52, spo2: null, skinTemp: null, strain: 8, sleepH: 7.5, sleepPerf: 85, sleepEff: 90, deepH: 1.5, remH: 1.8, respRate: 15,
  load: 50, ctl: 50, atl: 50, tsb: 0, workouts: 1, trainingMin: 60, ...p,
});
/** 120 Tage; alle 6 Tage ein harter Tag (Strain 17), danach Erholung um `drop` Punkte je Tag abklingend. */
function series(drop: number[], sleepAfter?: (k: number) => number) {
  const out: DayPoint[] = [];
  for (let i = 0; i < 120; i++) {
    const day = addDays(TODAY, -119 + i), k = i % 6;
    const after = k >= 1 && k <= drop.length ? drop[k - 1] : 0;
    out.push(point(day, { strain: k === 0 ? 17 : 8, recovery: 60 - after, hrv: 60 - after / 2, rhr: 52 + after / 10, sleepH: k === 1 && sleepAfter ? sleepAfter(i) : 7.5 }));
  }
  return out;
}

describe("Erholungskurve", () => {
  it("Tage bis zur Rückkehr und Kurve", () => {
    const r = recoveryCurve(series([20, 10, 2]), TODAY, 120);
    if (!r.available) throw new Error(r.reason);
    expect(r.threshold).toBe(14);
    expect(r.isolatedOnly).toBe(true);
    expect(r.backToNormalDays).toBe(3);
    expect(r.curve[1].recoveryVsAvg!).toBeLessThan(-10);
    expect(r.curve[1].hrvVsAvgPct!).toBeLessThan(0);
    expect(r.curve[1].rhrVsAvg!).toBeGreaterThan(0);
    expect(r.hints[0]).toMatch(/etwa 3 Tage.*2 lockere Tage/);
  });

  it("schnelle Erholung und Schlaf-Effekt", () => {
    // Nach jedem zweiten harten Tag lange Nacht (9 h) mit besserer Erholung
    const s = series([2]).map((p, i) => (i % 6 === 1 ? { ...p, sleepH: i % 12 === 1 ? 9 : 6, recovery: i % 12 === 1 ? 68 : 52 } : p));
    const r = recoveryCurve(s, TODAY, 120);
    if (!r.available) throw new Error(r.reason);
    expect(r.sleepEffect).toBe(16);
    expect(r.hints.join(" ")).toMatch(/länger als üblich.*16 Punkte/);
  });

  it("zu wenige harte Tage", () => {
    const flat = Array.from({ length: 60 }, (_, i) => point(addDays(TODAY, -59 + i), {}));
    const r = recoveryCurve(flat, TODAY, 60);
    expect(r.available).toBe(false);
    expect(recoveryCurve([], TODAY, 60).available).toBe(false);
  });
});
