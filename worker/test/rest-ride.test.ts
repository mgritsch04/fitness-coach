import { describe, expect, it } from "vitest";
import { addDays, type DayPoint, type Trend } from "../src/core/analysis";
import type { CoachAdvice } from "../src/core/coach";
import { restRideAdvice, type RestRideInput } from "../src/core/rest-ride";

// Alle Werte synthetisch, keine echten Messwerte.
const TODAY = "2026-03-10";
const point = (day: string, o: Partial<DayPoint> = {}): DayPoint => ({
  day, recovery: 50, hrv: 60, rhr: 50, spo2: null, skinTemp: null, strain: 10, sleepH: 7.5, sleepPerf: null, sleepEff: null, deepH: null, remH: null,
  respRate: null, load: 50, ctl: 50, atl: 50, tsb: 0, workouts: 1, trainingMin: 60, ...o,
});
const series = (today: Partial<DayPoint> = {}, before: Partial<DayPoint> = {}) => [
  ...[3, 2, 1].map((n) => point(addDays(TODAY, -n), before)),
  point(TODAY, { load: 0, workouts: 0, ...today }),
];
const coach = (readiness: CoachAdvice["readiness"]): CoachAdvice => ({
  day: TODAY, readiness, score: 30, headline: "", suggestion: "", targetLoad: null, reasons: [], warnings: [], disclaimer: "",
});
const rhr = { baseline: 50 } as Trend;
const input = (o: Partial<RestRideInput> = {}): RestRideInput => ({ coach: coach("rest"), series: series(), today: TODAY, rhrTrend: rhr, sleepNeedH: 8, ...o });

describe("Ruhetag: locker ausfahren (#324)", () => {
  it("nur bei Ruhe", () => {
    expect(restRideAdvice(input({ coach: coach("easy") }))).toBeNull();
  });
  it("unauffällige Werte: 30–45 min Zone 1", () => {
    const r = restRideAdvice(input())!;
    expect(r.verdict).toBe("spin");
    expect(r.minutes).toEqual({ min: 30, max: 45 });
    expect(r.text).toContain("Zone 1");
  });
  it("rote Erholung und wenig Schlaf: kürzer, mit Begründung", () => {
    const r = restRideAdvice(input({ series: series({ recovery: 28, sleepH: 6 }) }))!;
    expect(r.verdict).toBe("spin");
    expect(r.minutes).toEqual({ min: 20, max: 30 });
    expect(r.text).toContain("Erholung 28 %");
    expect(r.text).toContain("6.0 h Schlaf");
  });
  it("viel Belastung in den letzten Tagen: kürzer", () => {
    expect(restRideAdvice(input({ series: series({}, { load: 90 }) }))!.minutes).toEqual({ min: 20, max: 30 });
  });
  it("ganz frei bei sehr schlechter Erholung, hohem Ruhepuls, Krankheit oder Alarm", () => {
    expect(restRideAdvice(input({ series: series({ recovery: 15 }) }))!.verdict).toBe("off");
    expect(restRideAdvice(input({ series: series({ rhr: 59 }) }))!.text).toContain("Ruhepuls 9 Schläge");
    expect(restRideAdvice(input({ journalToday: { day: TODAY, feeling: null, energy: null, soreness: null, stress: null, motivation: null, notes: null, tags: ["Erkältet"] } }))!.verdict).toBe("off");
    expect(restRideAdvice(input({ warning: { level: "alert" } as RestRideInput["warning"] }))!.verdict).toBe("off");
    expect(restRideAdvice(input({ series: series({ sleepH: 4.5 }) }))!.minutes).toBeNull();
  });
  it("Winterbetrieb nennt die Rolle", () => {
    expect(restRideAdvice(input({ indoor: true }))!.text).toContain("Rolle");
  });
});
