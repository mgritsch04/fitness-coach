import { describe, expect, it } from "vitest";
import { bestAfter, durabilityReport, readRideStreams, secondAtWork, totalKj } from "../src/core/durability";
import { upsertWorkout, upsertWorkoutStream } from "../src/core/repository";
import { fakeD1 } from "./fake-d1";

// Synthetische Leistungsreihen, keine echten Messwerte.
const TODAY = "2026-04-30";
/** `minutes` Minuten mit `base` W, darin Blöcke ab Minute `at` (Standard 5 min) mit `watts`. */
function ride(minutes: number, base: number, blocks: { at: number; watts: number; len?: number }[]) {
  const p = Array.from({ length: minutes * 60 }, () => base as number | null);
  for (const b of blocks) for (let t = b.at * 60; t < (b.at + (b.len ?? 5)) * 60; t++) p[t] = b.watts;
  return p;
}

describe("Ermüdungsresistenz", () => {
  it("Arbeit und Zeitpunkt", () => {
    const p = ride(60, 200, []); // 200 W · 3600 s = 720 kJ
    expect(totalKj(p)).toBeCloseTo(720, 5);
    expect(secondAtWork(p, 500)).toBe(2500);
    expect(secondAtWork(p, 1000)).toBeNull();
    expect(bestAfter(p, 3400, 300)).toBeNull();
  });

  it("vergleicht frische und vorbelastete Bestleistung", () => {
    // 3 h mit 180 W (≈ 1944 kJ), 5-min-Block 350 W in Minute 10 (frisch) und 320 W in Minute 150 (nach ~1600 kJ)
    const r = durabilityReport([{ day: "2026-04-20", source: "mywhoosh", sourceId: "a", power: ride(180, 180, [{ at: 10, watts: 350 }, { at: 150, watts: 320 }]) }], TODAY, 90);
    const five = r.table[0].levels;
    expect(five[0].watts).toBe(350);
    expect(five.find((l) => l.kj === 1500)!.watts).toBe(320);
    expect(five.find((l) => l.kj === 1500)!.pctOfFresh).toBeCloseTo(91.4, 1);
    expect(five.find((l) => l.kj === 1000)!.pctOfFresh).toBeCloseTo(91.4, 1);
    expect(r.verdict).toMatch(/Solide/);
  });

  it("zu kurze Fahrten: Hinweis statt Einordnung", () => {
    const r = durabilityReport([{ day: "2026-04-20", source: "mywhoosh", sourceId: "a", power: ride(30, 200, [{ at: 5, watts: 300 }]) }], TODAY, 90);
    expect(r.table[0].levels[1].watts).toBeNull();
    expect(r.verdict).toMatch(/mindestens 500 kJ/);
    expect(durabilityReport([], TODAY, 90).verdict).toMatch(/Noch keine Fahrten/);
  });

  it("ignoriert Fahrten außerhalb des Zeitraums", () => {
    const r = durabilityReport([{ day: "2025-01-01", source: "mywhoosh", sourceId: "x", power: ride(60, 200, []) }], TODAY, 90);
    expect(r.rides).toBe(0);
  });

  it("liest Fahrten mit Sekundenwerten aus D1", async () => {
    const db = fakeD1();
    const start = "2026-04-20T16:00:00.000Z";
    const power = ride(40, 200, []);
    await upsertWorkout(db, { source: "mywhoosh", sourceId: "r1", day: "2026-04-20", startTime: start, endTime: "2026-04-20T16:40:00.000Z", sport: "cycling",
      durationS: 2400, distanceM: null, energyKj: null, avgHr: null, maxHr: null, avgPowerW: 200, normalizedPowerW: 200, strain: null }).run();
    await upsertWorkoutStream(db, { source: "mywhoosh", sourceId: "r1", startTime: start, power, heartRate: null, cadence: null, powerCurve: null }).run();
    const rides = await readRideStreams(db, "2026-04-01");
    expect(rides).toHaveLength(1);
    expect(rides[0].power).toHaveLength(2400);
    expect(await readRideStreams(db, "2026-04-21")).toHaveLength(0);
  });
});
