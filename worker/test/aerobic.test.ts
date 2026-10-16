import { describe, expect, it } from "vitest";
import { aerobicReport, readHrRideStreams, steadyRide, type HrRideStream } from "../src/core/aerobic";
import { upsertWorkout, upsertWorkoutStream } from "../src/core/repository";
import { fakeD1 } from "./fake-d1";

// Synthetische Sekundenreihen, keine echten Messwerte.
const TODAY = "2026-04-30";
/** `minutes` Minuten mit konstant `watts`, Puls steigt linear um `drift` (Anteil) über die Fahrt. */
function ride(day: string, minutes: number, drift: number, watts: (t: number) => number = () => 180): HrRideStream {
  const n = minutes * 60;
  return {
    day, source: "mywhoosh", sourceId: `${day}-${minutes}`,
    power: Array.from({ length: n }, (_, t) => watts(t)),
    heartRate: Array.from({ length: n }, (_, t) => 130 * (1 + drift * (t / n))),
  };
}

describe("Aerobe Basis", () => {
  it("misst die Entkopplung gleichmäßiger Fahrten ohne Aufwärmen", () => {
    const r = steadyRide(ride("2026-04-20", 90, 0));
    expect(r.steady && r.decouplingPct).toBe(0);
    const d = steadyRide(ride("2026-04-20", 90, 0.2));
    expect(d.steady).toBe(true);
    if (d.steady) {
      expect(d.decouplingPct).toBeGreaterThan(4);
      expect(d.band).not.toBe("good");
      expect(d.vi).toBeCloseTo(1, 2);
    }
  });

  it("überspringt kurze und ungleichmäßige Fahrten", () => {
    expect(steadyRide(ride("2026-04-20", 40, 0))).toMatchObject({ steady: false, reason: "short" });
    // Intervalle: 1 min 400 W, 1 min 60 W
    expect(steadyRide(ride("2026-04-20", 90, 0, (t) => (Math.floor(t / 60) % 2 ? 60 : 400)))).toMatchObject({ steady: false, reason: "variable" });
  });

  it("vergleicht die letzten vier Fahrten mit den vier davor", () => {
    const rides = Array.from({ length: 8 }, (_, k) => ride(`2026-04-${String(k * 3 + 2).padStart(2, "0")}`, 60 + k * 10, k < 4 ? 0.14 : 0.03));
    const r = aerobicReport(rides, TODAY, 120);
    expect(r.rides).toHaveLength(8);
    expect(r.current.medianPct!).toBeLessThan(5);
    expect(r.current.previousMedianPct!).toBeGreaterThan(5);
    expect(r.trend?.direction).toBe("better");
    expect(r.longestGood?.durationMin).toBe(130);
    expect(r.verdict).toMatch(/Gute aerobe Basis/);
  });

  it("Hinweis ohne passende Fahrten", () => {
    const r = aerobicReport([ride("2025-01-01", 90, 0)], TODAY, 120);
    expect(r.rides).toHaveLength(0);
    expect(r.trend).toBeNull();
    expect(r.verdict).toMatch(/Noch keine gleichmäßige Fahrt/);
  });

  it("liest nur Fahrten mit Leistung und Puls aus D1", async () => {
    const db = fakeD1();
    const start = "2026-04-20T16:00:00.000Z";
    const r = ride("2026-04-20", 60, 0);
    for (const [id, hr] of [["r1", r.heartRate], ["r2", null]] as const) {
      await upsertWorkout(db, { source: "mywhoosh", sourceId: id, day: "2026-04-20", startTime: start, endTime: "2026-04-20T17:00:00.000Z", sport: "cycling",
        durationS: 3600, distanceM: null, energyKj: null, avgHr: null, maxHr: null, avgPowerW: 180, normalizedPowerW: 180, strain: null }).run();
      await upsertWorkoutStream(db, { source: "mywhoosh", sourceId: id, startTime: start, power: [...r.power], heartRate: hr ? [...hr] : null, cadence: null, powerCurve: null }).run();
    }
    const rides = await readHrRideStreams(db, "2026-04-01");
    expect(rides.map((x) => x.sourceId)).toEqual(["r1"]);
    expect(rides[0].heartRate).toHaveLength(3600);
  });
});
