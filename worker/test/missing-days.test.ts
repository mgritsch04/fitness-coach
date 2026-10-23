import { describe, expect, it } from "vitest";
import { addDays, daySeries, trend, type DayPoint } from "../src/core/analysis";
import { coachAdvice } from "../src/core/coach";

// Alle Werte synthetisch (#379: fehlende WHOOP-Tage).
const flat = { status: "normal" as const, last: null, lastDay: null, avg7: null, baseline: null, baselineSd: null, deltaPct: null };
const trends = { hrv: flat, rhr: flat, recovery: flat, sleepH: flat } as Parameters<typeof coachAdvice>[2];
const empty = (day: string, o: Partial<DayPoint> = {}): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 40, atl: 40, tsb: 5, workouts: 0, trainingMin: 0, ...o,
});

describe("Fehlende Tage", () => {
  it("daySeries markiert vergangene leere Tage als noData, heute nie", () => {
    const daily = [{ day: "2026-03-01", recovery_score: 70, hrv_ms: 60, resting_hr: 50 }, { day: "2026-03-04", recovery_score: 65, hrv_ms: 58, resting_hr: 51 }] as never;
    const s = daySeries(daily, [], [], [], "2026-03-01", "2026-03-05");
    expect(s.map((p) => !!p.noData)).toEqual([false, true, true, false, false]);
    expect(s[1].recovery).toBeNull();
  });

  it("Trends lassen die Lücke aus statt sie als 0 zu zählen", () => {
    const series: DayPoint[] = [];
    for (let i = 0; i < 40; i++) {
      const day = addDays("2026-03-01", i);
      series.push(empty(day, i >= 36 && i < 38 ? { noData: true } : { recovery: 70, hrv: 60 }));
    }
    const t = trend(series, "hrv", "2026-04-09");
    expect(t.avg7).toBe(60);
  });

  it("Empfehlung nach Lücke: Schätzung benannt, keine harte Einheit auf Verdacht", () => {
    const series = [empty("2026-03-08", { noData: true }), empty("2026-03-09", { noData: true }), empty("2026-03-10", { ctl: 50, tsb: 20 })];
    const a = coachAdvice(series, "2026-03-10", trends, 8);
    expect(a.dataGap).toEqual({ days: 2, since: "2026-03-08" });
    expect(a.reasons.some((r) => r.factor === "data" && /Schätzung wegen fehlender Daten/.test(r.text))).toBe(true);
    expect(a.readiness).not.toBe("hard");
  });

  it("ohne Lücke bleibt alles wie bisher", () => {
    const a = coachAdvice([empty("2026-03-09", { recovery: 60 }), empty("2026-03-10", { recovery: 85, sleepH: 8, ctl: 50 })], "2026-03-10", trends, 8);
    expect(a.dataGap).toBeNull();
    expect(a.reasons.some((r) => /fehlender Daten/.test(r.text))).toBe(false);
  });
});
