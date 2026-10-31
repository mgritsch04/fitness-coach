import { describe, expect, it } from "vitest";
import { compareVerdict, diffCurves, diffStats, hrAtSamePower, similarRides } from "../src/core/workout-compare";

// Synthetische Reihen, keine echten Messwerte.
const ride = (watts: number, hr: number, n: number) => ({ power: Array<number>(n).fill(watts), heartRate: Array<number>(n).fill(hr) });
const join = (...parts: { power: number[]; heartRate: number[] }[]) => ({ power: parts.flatMap((p) => p.power), heartRate: parts.flatMap((p) => p.heartRate) });

describe("Fahrten vergleichen (#219)", () => {
  it("Puls bei gleicher Leistung: nur gemeinsame Stufen mit genug Zeit", () => {
    const a = join(ride(200, 150, 600), ride(250, 165, 600), ride(300, 180, 60));
    const b = join(ride(202, 146, 600), ride(251, 160, 600), ride(320, 170, 600));
    const rows = hrAtSamePower(a, b);
    expect(rows.map((r) => r.fromW)).toEqual([200, 240]);
    expect(rows[0]).toMatchObject({ aHr: 150, bHr: 146, diffHr: -4 });
    expect(rows[1].diffHr).toBe(-5);
  });
  it("Kurzfazit: niedrigerer, höherer, gleicher Puls, zu wenig Daten", () => {
    const row = (d: number) => ({ fromW: 200, toW: 220, aSeconds: 600, bSeconds: 600, aHr: 150, bHr: 150 + d, diffHr: d });
    expect(compareVerdict([row(-5)])).toMatch(/niedriger/);
    expect(compareVerdict([row(6)])).toMatch(/höher/);
    expect(compareVerdict([row(0.5)])).toMatch(/gleich/);
    expect(compareVerdict([])).toBeNull();
    expect(compareVerdict([{ ...row(-5), aSeconds: 120, bSeconds: 120 }])).toBeNull();
  });
  it("Kennzahlen- und Kurvendifferenz", () => {
    const d = diffStats({ avgPowerW: 200, avgHr: 150, tssEstimate: null }, { avgPowerW: 210, avgHr: 145, tssEstimate: 50 });
    expect(d.find((r) => r.key === "avgPowerW")).toMatchObject({ diff: 10, diffPct: 5 });
    expect(d.find((r) => r.key === "avgHr")?.diff).toBe(-5);
    expect(d.find((r) => r.key === "tssEstimate")?.diff).toBeNull();
    expect(diffCurves({ "300": 250 }, { "300": 262, "1200": 220 })).toEqual([
      { durationS: 300, a: 250, b: 262, diffW: 12 },
      { durationS: 1200, a: null, b: 220, diffW: null },
    ]);
  });
  it("Vorschläge: gleiche Sportart, ähnliche Dauer, ohne die Fahrt selbst", () => {
    const c = (id: string, sport: string, dur: number) => ({ day: "2026-10-01", source: "mywhoosh", source_id: id, sport, duration_s: dur });
    const t = c("t", "cycling", 3600);
    const out = similarRides(t, [t, c("1", "cycling", 3300), c("2", "cycling", 7200), c("3", "running", 3600)]);
    expect(out.map((x) => x.source_id)).toEqual(["1"]);
  });
});
