import { describe, expect, it } from "vitest";
import { mergeWorkouts, type WorkoutRow } from "../src/core/analysis";
import { hrZoneReport, parseZones } from "../src/core/performance";
import { readWorkouts, runBatched, upsertWorkout } from "../src/core/repository";
import { mapWorkout, mapZones } from "../src/providers/whoop/map";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch, keine echten Messwerte.

const MIN = 60_000;
const zones = (...minutes: number[]) => ({
  zone_zero_milli: minutes[0] * MIN, zone_one_milli: minutes[1] * MIN, zone_two_milli: minutes[2] * MIN,
  zone_three_milli: minutes[3] * MIN, zone_four_milli: minutes[4] * MIN, zone_five_milli: minutes[5] * MIN,
});

const row = (o: Partial<WorkoutRow>): WorkoutRow => ({
  day: "2026-03-02", source: "whoop", source_id: "w1", start_time: "2026-03-02T16:00:00.000Z", end_time: "2026-03-02T17:00:00.000Z",
  sport: "cycling", duration_s: 3600, distance_m: null, energy_kj: null, avg_hr: null, max_hr: null, avg_power_w: null,
  normalized_power_w: null, strain: null, ...o,
});

describe("Pulszonen von WHOOP", () => {
  it("übernimmt zone_durations als Sekunden je Zone", () => {
    expect(mapZones(zones(1, 10, 20, 15, 10, 4))).toEqual([60, 600, 1200, 900, 600, 240]);
    expect(mapZones(undefined)).toBeNull();
    expect(mapZones({})).toBeNull();
    const w = mapWorkout({ id: "a", start: "2026-03-02T16:00:00Z", end: "2026-03-02T17:00:00Z", score_state: "SCORED", score: { strain: 12, zone_durations: { zone_two_milli: 120_000 } } });
    expect(w.hrZoneS).toEqual([0, 0, 120, 0, 0, 0]);
  });

  it("speichert sie, ohne sie bei einem Abgleich ohne Zonen zu löschen", async () => {
    const db = fakeD1();
    const base = { source: "whoop" as const, sourceId: "a", day: "2026-03-02", startTime: "2026-03-02T16:00:00Z", endTime: "2026-03-02T17:00:00Z", sport: "cycling", durationS: 3600, distanceM: null, energyKj: null, avgHr: 140, maxHr: 170, avgPowerW: null, normalizedPowerW: null, strain: 12 };
    await runBatched(db, [upsertWorkout(db, { ...base, hrZoneS: [0, 600, 1200, 900, 600, 300] })]);
    await runBatched(db, [upsertWorkout(db, { ...base, strain: 13 })]);
    const [r] = (await readWorkouts(db, "2026-03-01")) as unknown as WorkoutRow[];
    expect(r.strain).toBe(13);
    expect(parseZones(r.hr_zone_s)).toEqual([0, 600, 1200, 900, 600, 300]);
  });

  it("verteilt Zeit je Woche und bewertet 80/20", () => {
    const ws = [
      row({ day: "2026-03-02", hr_zone_s: JSON.stringify([0, 3600, 3600, 1800, 0, 0]) }),
      row({ day: "2026-03-04", source_id: "w2", hr_zone_s: JSON.stringify([0, 0, 1800, 1800, 1200, 600]) }),
      row({ day: "2026-03-10", source_id: "w3", hr_zone_s: JSON.stringify([0, 3600, 3600, 0, 0, 0]) }),
      row({ day: "2026-03-11", source_id: "w4", hr_zone_s: null }),
    ];
    const r = hrZoneReport(ws, "2026-03-01", "2026-03-15");
    expect(r.weeks.map((w) => w.week)).toEqual(["2026-02-23", "2026-03-02", "2026-03-09"]);
    expect(r.weeks[1]).toMatchObject({ workouts: 2, totalMin: 240, minutes: [0, 60, 90, 60, 20, 10] });
    expect(r.weeks[1].easyPct).toBe(87.5);
    expect(r.total).toMatchObject({ workouts: 3, totalMin: 360, easyPct: 91.7, moderatePct: 5.6, hardPct: 2.8 });
    expect(r.verdict).toContain("80/20");
  });

  it("zu viel Mitte → Hinweis", () => {
    const r = hrZoneReport([row({ hr_zone_s: JSON.stringify([0, 0, 1800, 3600, 5400, 600]) })], "2026-03-02", "2026-03-02");
    expect(r.verdict).toContain("mittleren Bereich");
  });

  it("WHOOP-Zonen landen in der zusammengeführten Wahoo-Fahrt", () => {
    const merged = mergeWorkouts([
      row({ hr_zone_s: "[0,1,2,3,4,5]" }),
      row({ source: "wahoo", source_id: "x", avg_power_w: 200 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ source: "wahoo", hr_zone_s: "[0,1,2,3,4,5]" });
  });

  it("ignoriert kaputte Werte", () => {
    expect(parseZones("[1,2]")).toBeNull();
    expect(parseZones("kein json")).toBeNull();
    expect(parseZones(null)).toBeNull();
  });
});
