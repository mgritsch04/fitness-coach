import { describe, expect, it } from "vitest";
import { compactDashboard, fromColumns, toColumns } from "../src/core/compact";

describe("kompakte Übertragung", () => {
  it("Spalten hin und zurück ergeben dieselben Zeilen, fehlende Felder werden null", () => {
    const rows = [{ day: "2026-03-01", hrv: 60, load: null }, { day: "2026-03-02", strain: 9.5 }];
    const c = toColumns(rows);
    expect(c.keys).toEqual(["day", "hrv", "load", "strain"]);
    expect(c.rows[1]).toEqual(["2026-03-02", null, null, 9.5]);
    expect(fromColumns(c)).toEqual([{ day: "2026-03-01", hrv: 60, load: null, strain: null }, { day: "2026-03-02", hrv: null, load: null, strain: 9.5 }]);
  });

  it("leere Listen bleiben leer", () => {
    expect(fromColumns(toColumns([]))).toEqual([]);
  });

  it("get_dashboard kompakt ändert nur days und workouts und ist deutlich kleiner", () => {
    const days = Array.from({ length: 180 }, (_, i) => ({ day: `d${i}`, recovery: 50 + (i % 40), hrv: 60, rhr: 52, strain: 11.2, sleepH: 7.1, load: 40, ctl: 30, atl: 35, tsb: -5 }));
    const workouts = Array.from({ length: 250 }, (_, i) => ({ day: `d${i}`, sport: "cycling", durationMin: 60, avgHr: 140, avgPowerW: null, load: 70, intensity: 0.8 }));
    const d = { today: "d179", days, workouts, weeks: [{ week: "w1" }] };
    const c = compactDashboard(d);
    expect(c.weeks).toBe(d.weeks);
    expect(c.compact).toBe(1);
    expect(fromColumns(c.days)).toEqual(days);
    expect(JSON.stringify(c).length).toBeLessThan(JSON.stringify(d).length * 0.6);
  });
});
