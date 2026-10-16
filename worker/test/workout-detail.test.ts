import { describe, expect, it } from "vitest";
import { powerZones } from "../src/core/performance";
import { decoupling, detectIntervals, downsample, loadWorkoutDetail, timeInZones, workoutDetail } from "../src/core/workout-detail";
import { importFit } from "../src/providers/mywhoosh/import";
import { writeSettings } from "../src/core/settings";
import { fakeD1 } from "./fake-d1";
import { syntheticRide, toBase64 } from "./fit-builder";

// Synthetische Intervalleinheit: 10 min locker (150 W), 3 × (3 min 300 W / 2 min 150 W), 5 min locker.
const workoutPower = (s: number) => {
  if (s < 600 || s >= 600 + 3 * 300) return 150;
  return (s - 600) % 300 < 180 ? 300 : 150;
};
const seconds = 600 + 900 + 300;
const power = Array.from({ length: seconds }, (_, s) => workoutPower(s));
const hr = Array.from({ length: seconds }, (_, s) => 120 + Math.round(workoutPower(s) / 10));

describe("Workout-Detail", () => {
  it("verkleinert die Reihen und mittelt je Abschnitt", () => {
    const d = downsample({ power: [100, 200, 300, null], heartRate: null, cadence: [90, 90, null, null] }, 2);
    expect(d.stepS).toBe(2);
    expect(d.points).toEqual([
      { t: 0, power: 150, hr: null, cadence: 90 },
      { t: 2, power: 300, hr: null, cadence: null },
    ]);
  });

  it("zählt Sekunden je Zone", () => {
    const z = timeInZones(power, powerZones(250))!;
    // 300 W = 120 % FTP → Zone 5 (VO2max: 106–120 %), 150 W = 60 % → Zone 2
    expect(z.find((x) => x.zone === 5)!.seconds).toBe(540);
    expect(z.find((x) => x.zone === 2)!.seconds).toBe(seconds - 540);
    expect(z.reduce((a, x) => a + x.sharePct, 0)).toBeCloseTo(100, 0);
    expect(timeInZones(power, null)).toBeNull();
  });

  it("erkennt die drei Intervalle mit FTP und ohne FTP", () => {
    for (const ftp of [250, null]) {
      const { intervals, basis } = detectIntervals({ power, heartRate: hr, cadence: null }, ftp);
      expect(basis).toBe(ftp ? "ftp" : "average");
      expect(intervals).toHaveLength(3);
      for (const [i, iv] of intervals.entries()) {
        expect(Math.abs(iv.startS - (600 + i * 300))).toBeLessThanOrEqual(15);
        expect(Math.abs(iv.durationS - 180)).toBeLessThanOrEqual(30);
        expect(iv.avgPowerW).toBeGreaterThan(270);
        expect(iv.avgHr).toBeGreaterThan(140);
      }
      if (ftp) expect(intervals[0].pctFtp).toBeGreaterThan(105);
    }
    expect(detectIntervals({ power: new Array(3600).fill(200), heartRate: null, cadence: null }, 250).intervals).toEqual([]);
  });

  it("berechnet die Entkopplung bei steigendem Puls", () => {
    const n = 3600;
    const p = new Array(n).fill(200);
    const h = Array.from({ length: n }, (_, i) => (i < n / 2 ? 140 : 150));
    const d = decoupling(p, h)!;
    expect(d.pct).toBeCloseTo(((200 / 140 - 200 / 150) / (200 / 140)) * 100, 1);
    expect(decoupling(p.slice(0, 600), h.slice(0, 600))).toBeNull();
  });

  it("Kennzahlen: NP, IF, VI und TSS-Schätzung", () => {
    const d = workoutDetail({ power, heartRate: hr, cadence: null }, { ftpW: 250, thresholdHr: 160 });
    expect(d.stats.durationS).toBe(seconds);
    expect(d.stats.avgPowerW).toBe(Math.round((540 * 300 + (seconds - 540) * 150) / seconds));
    expect(d.stats.normalizedPowerW!).toBeGreaterThan(d.stats.avgPowerW!);
    expect(d.stats.variabilityIndex!).toBeGreaterThan(1);
    expect(d.stats.intensityFactor).toBeCloseTo(d.stats.normalizedPowerW! / 250, 1);
    expect(d.stats.maxPowerW).toBe(300);
    expect(d.zones.hr).not.toBeNull();
  });
});

describe("Workout-Detail aus D1", () => {
  it("liefert die neueste Fahrt mit Sekundenwerten und meldet fehlende", async () => {
    const db = fakeD1();
    expect(await loadWorkoutDetail(db)).toMatchObject({ found: false, available: [] });
    await writeSettings(db, { ftpW: 250 });
    await importFit(db, toBase64(syntheticRide({ start: "2026-03-01T17:00:00Z", seconds: seconds, power: workoutPower })));
    const d = await loadWorkoutDetail(db);
    expect(d.found).toBe(true);
    if (!d.found) return;
    expect(d.workout).toMatchObject({ source: "mywhoosh", source_id: "fit-2026-03-01T17:00:00.000Z" });
    expect(d.reference.ftpW).toBe(250);
    expect(d.intervals.intervals).toHaveLength(3);
    expect(d.series.points.length).toBeLessThanOrEqual(600);
    expect(d.available).toHaveLength(1);
    expect(await loadWorkoutDetail(db, "whoop", "gibt-es-nicht")).toMatchObject({ found: false });
  });
});
