import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import { classify, hrvTrend } from "../src/core/hrv-trend";

// Synthetische HRV-Verläufe, keine echten Messwerte.
const TODAY = "2026-04-30";
const point = (day: string, hrv: number | null): DayPoint => ({
  day, recovery: null, hrv, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0,
});
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
/** 120 Tage um 60 ms mit ±noise %; die letzten `tail` Tage über f(i) verändert. */
function series(opts: { tail?: number; level?: (i: number) => number; noise?: (i: number) => number } = {}) {
  const r = rng(3), out: DayPoint[] = [];
  const tail = opts.tail ?? 0;
  for (let i = 119; i >= 0; i--) {
    const inTail = i < tail;
    const level = inTail && opts.level ? opts.level(i) : 60;
    const noise = inTail && opts.noise ? opts.noise(i) : 0.08;
    out.push(point(addDays(TODAY, -i), Math.round(level * (1 + (r() - 0.5) * 2 * noise))));
  }
  return out;
}

describe("HRV-Trend", () => {
  it("stabiler Verlauf liegt im Normalband", () => {
    const t = hrvTrend(series(), TODAY);
    expect(t.available).toBe(true);
    if (!t.available) return;
    expect(t.points).toHaveLength(90);
    expect(t.current.state).toBe("within");
    expect(["stable", "unsettled"]).toContain(t.pattern);
    expect(t.current.bandLow!).toBeLessThan(60);
    expect(t.current.bandHigh!).toBeGreaterThan(55);
  });

  it("sinkendes Mittel mit stärkerer Schwankung: Ermüdung", () => {
    // letzte 10 Tage auf 45 ms, die letzte Woche stark schwankend
    const t = hrvTrend(series({ tail: 10, level: () => 45, noise: (i) => (i < 7 ? 0.3 : 0.05) }), TODAY);
    if (!t.available) throw new Error(t.reason);
    expect(t.current.state).toBe("below");
    expect(t.pattern).toBe("fatigue");
    expect(t.advice).toMatch(/lockere Tage/);
  });

  it("niedrig und gleichförmig: mögliche Überreizung", () => {
    const t = hrvTrend(series({ tail: 14, level: () => 47, noise: () => 0.01 }), TODAY);
    if (!t.available) throw new Error(t.reason);
    expect(t.current.state).toBe("below");
    expect(t.pattern).toBe("saturation");
  });

  it("über dem Band: gut erholt", () => {
    const t = hrvTrend(series({ tail: 8, level: () => 75, noise: () => 0.05 }), TODAY);
    if (!t.available) throw new Error(t.reason);
    expect(t.pattern).toBe("high");
  });

  it("zu wenige Daten", () => {
    const few = series().map((p, i) => (i < 100 ? { ...p, hrv: null } : p));
    const t = hrvTrend(few, TODAY);
    expect(t.available).toBe(false);
  });

  it("Deutung je Kombination", () => {
    expect(classify("within", 5, 5, 5)).toBe("stable");
    expect(classify("within", 9, 5, 5)).toBe("unsettled");
    expect(classify("below", 7, 5, 5)).toBe("fatigue");
    expect(classify("below", 3, 5, 5)).toBe("saturation");
    expect(classify("below", 5, 5, 5)).toBe("low");
    expect(classify("below", 7, 9, 5)).toBe("fatigue");
    expect(classify("above", 5, 5, 5)).toBe("high");
  });
});
