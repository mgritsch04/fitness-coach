import { describe, expect, it } from "vitest";
import { classOf, executionOf, fadePct, intervalReport, readIntervalRides, sessionQuality, type IntervalRide } from "../src/core/intervals";
import { upsertWorkout, upsertWorkoutStream } from "../src/core/repository";
import { fakeD1 } from "./fake-d1";

// Synthetische Sekundenreihen, keine echten Messwerte.
const TODAY = "2026-04-30";
const FTP = 280;
/** 15 min locker, dann `reps` Wiederholungen à `work` s mit `watts(r)`, je `rest` s Pause, 10 min locker. */
function session(day: string, reps: number, work: number, rest: number, watts: (r: number) => number, hr = (r: number) => 160 + r): IntervalRide {
  const power: number[] = [], heartRate: number[] = [];
  const push = (n: number, p: number, h: number) => { for (let t = 0; t < n; t++) { power.push(p); heartRate.push(h); } };
  push(900, 150, 120);
  for (let r = 0; r < reps; r++) { push(work, watts(r), hr(r)); push(rest, 110, 125); }
  push(600, 150, 120);
  return { day, source: "mywhoosh", sourceId: day, power, heartRate, cadence: null };
}

describe("Intervall-Qualität", () => {
  it("Klassen, Abfall und Einordnung", () => {
    expect([classOf(60), classOf(240), classOf(720), classOf(2400)]).toEqual(["short", "vo2", "threshold", "long"]);
    expect(executionOf(1)).toBe("even");
    expect(executionOf(5)).toBe("slight");
    expect(executionOf(12)).toBe("strong");
    expect(executionOf(-5)).toBe("building");
    const rep = (w: number) => ({ startS: 0, durationS: 240, avgPowerW: w, pctFtp: null, avgHr: null, maxHr: null, avgCadence: null });
    expect(fadePct([rep(300), rep(300), rep(280), rep(270)])).toBeCloseTo(8.33, 1);
  });

  it("erkennt die Hauptserie und den Abfall", () => {
    const s = sessionQuality(session("2026-04-20", 5, 240, 180, (r) => 320 - r * 10, (r) => 160 + r * 3), FTP)!;
    expect(s.cls).toBe("vo2");
    expect(s.reps).toBe(5);
    expect(s.repDurationS).toBeGreaterThanOrEqual(220);
    expect(s.fadePct).toBeGreaterThan(8);
    expect(s.execution).toBe("strong");
    expect(s.hrCreepBpm).toBe(12);
    expect(s.pctFtp).toBe(Math.round((s.avgPowerW / FTP) * 100));
    // Gleichmäßige Fahrt ohne Intervalle: keine Serie
    expect(sessionQuality(session("2026-04-21", 0, 0, 0, () => 0), FTP)).toBeNull();
  });

  it("Verlauf je Art und Hinweise", () => {
    const rides = [0, 1, 2].map((k) => session(`2026-04-${10 + k * 5}`, 3, 720, 300, () => 250 + k * 6));
    const r = intervalReport(rides, FTP, TODAY, 90);
    expect(r.totalSessions).toBe(3);
    const thr = r.classes.find((c) => c.cls === "threshold")!;
    expect(thr.sessions).toBe(3);
    expect(thr.changePct).toBeCloseTo(4.8, 1);
    expect(r.hints.join(" ")).toMatch(/Steigerung möglich/);
    expect(r.hints.join(" ")).toMatch(/gestiegen um 4,8 %/);
    expect(r.sessions[0].day).toBe("2026-04-20");

    const hard = intervalReport([0, 1].map((k) => session(`2026-04-2${k}`, 5, 240, 180, (r) => 330 - r * 12)), FTP, TODAY, 90);
    expect(hard.hints[0]).toMatch(/deutlich abgefallen/);
    expect(intervalReport([], FTP, TODAY, 90).hints[0]).toMatch(/Noch kein Intervalltraining/);
  });

  it("liest Fahrten mit Leistung aus D1", async () => {
    const db = fakeD1();
    const start = "2026-04-20T16:00:00.000Z";
    const s = session("2026-04-20", 3, 240, 120, () => 300);
    await upsertWorkout(db, { source: "mywhoosh", sourceId: "i1", day: "2026-04-20", startTime: start, endTime: "2026-04-20T17:00:00.000Z", sport: "cycling",
      durationS: s.power.length, distanceM: null, energyKj: null, avgHr: null, maxHr: null, avgPowerW: 180, normalizedPowerW: 200, strain: null }).run();
    await upsertWorkoutStream(db, { source: "mywhoosh", sourceId: "i1", startTime: start, power: s.power, heartRate: null, cadence: null, powerCurve: null }).run();
    const rides = await readIntervalRides(db, "2026-04-01");
    expect(rides).toHaveLength(1);
    expect(rides[0].heartRate).toBeNull();
    expect(intervalReport(rides, FTP, TODAY, 90).totalSessions).toBe(1);
  });
});
