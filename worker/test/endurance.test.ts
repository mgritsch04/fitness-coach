import { describe, expect, it } from "vitest";
import { addDays, type MergedWorkout, type WorkoutLoad } from "../src/core/analysis";
import { criticalPower, efficiencyRides, efficiencyTrend, enduranceProfile, timeToExhaustionS } from "../src/core/endurance";
import type { CurvePoint } from "../src/core/performance";

// Synthetische Kurven und Fahrten, keine echten Messwerte.
const CP = 250, WP = 20_000;
const model = (d: number) => CP + WP / d;
const curve = (f = model): CurvePoint[] => [60, 180, 300, 600, 1200, 3600].map((d) => ({ durationS: d, watts: f(d), day: "2026-03-01", source: "mywhoosh" }));

describe("Critical Power", () => {
  it("findet CP und W′ eines idealen Profils", () => {
    const m = criticalPower(curve())!;
    expect(m).toMatchObject({ cpW: 250, wPrimeKj: 20, confidence: "high" });
    expect(m.points.map((p) => p.durationS)).toEqual([180, 300, 600, 1200]);
    expect(timeToExhaustionS(m, 300)).toBe(400);
    expect(timeToExhaustionS(m, 240)).toBeNull();
  });

  it("schlechte Daten: niedrige Sicherheit oder kein Modell", () => {
    // 20 min kaum unter 3 min → unplausibel großes W′ wird nicht hoch bewertet
    const flat = criticalPower(curve((d) => (d <= 300 ? 300 : 200)))!;
    expect(flat.confidence).toBe("low");
    expect(criticalPower(curve().filter((p) => p.durationS < 600))).toBeNull();
  });
});

type W = MergedWorkout & WorkoutLoad;
const ride = (day: string, np: number, hr: number, o: Partial<W> = {}): W => ({
  day, source: "mywhoosh", source_id: day, start_time: `${day}T16:00:00Z`, end_time: `${day}T17:00:00Z`, sport: "cycling", duration_s: 3600,
  distance_m: null, energy_kj: null, avg_hr: hr, max_hr: null, avg_power_w: np - 5, normalized_power_w: np, strain: null, avg_cadence_rpm: null, tss: null,
  sources: ["mywhoosh", "whoop"], load: 50, method: "power", intensity: 0.7, ...o,
}) as W;

describe("Effizienz-Faktor", () => {
  const T = "2026-03-31";
  const rides = [
    ...Array.from({ length: 6 }, (_, i) => ride(addDays(T, -70 + i * 7), 180, 140)), // EF 1,29
    ...Array.from({ length: 4 }, (_, i) => ride(addDays(T, -21 + i * 7), 190, 138)), // EF 1,38
    ride(addDays(T, -3), 260, 165, { intensity: 0.95 }), // hart: zählt nicht
    ride(addDays(T, -2), 180, 140, { duration_s: 1200 }), // zu kurz
  ];

  it("nur lockere, lange Fahrten mit Leistung und Puls", () => {
    const r = efficiencyRides(rides, addDays(T, -179));
    expect(r).toHaveLength(10);
    expect(r.at(-1)).toMatchObject({ npW: 190, avgHr: 138, ef: 1.38 });
  });

  it("Trend: letzte 4 Wochen gegen davor", () => {
    const t = efficiencyTrend(efficiencyRides(rides, addDays(T, -179)), T);
    expect(t.recentEf).toBe(1.38);
    expect(t.previousEf).toBe(1.29);
    expect(t.changePct).toBeCloseTo(7.3, 0);
    expect(t.verdict).toContain("gestiegen");
    expect(t.weekly.length).toBeGreaterThanOrEqual(9);
  });

  it("Profil mit Haltezeiten und FTP-Vergleich", () => {
    const p = enduranceProfile(curve(), rides, T, 240);
    expect(p.criticalPower?.cpW).toBe(250);
    expect(p.cpVsFtpPct).toBe(4.2);
    expect(p.holdTimes.find((h) => h.watts === 300)?.seconds).toBe(400);
    expect(enduranceProfile([], [], T, null)).toMatchObject({ criticalPower: null, holdTimes: [], cpVsFtpPct: null });
  });
});

describe("get_endurance_profile", () => {
  it("läuft gegen das echte Schema (leere Datenbank)", async () => {
    const { fakeD1 } = await import("./fake-d1");
    const { analysisContext, enduranceView } = await import("../src/core/analytics");
    const db = fakeD1();
    const r = enduranceView(await analysisContext(db, { days: 180 }));
    expect(r.criticalPower).toBeNull();
    expect(r.efficiency.changePct).toBeNull();
  });
});
