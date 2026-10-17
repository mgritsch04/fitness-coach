import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { environmentOf, indoorOutdoor } from "../src/core/indoor-outdoor";
import { analysisHighlights } from "../src/core/highlights";

// Synthetische Fahrten, keine echten Messwerte.
const TODAY = "2026-04-30";
function ride(k: number, out: boolean, ef: number, cadence: number, power = 200) {
  return { day: addDays(TODAY, -3 * k - 1), source: out ? "wahoo" : "mywhoosh", sport: "cycling", duration_s: 3600, distance_m: out ? 40000 : 30000,
    avg_hr: Math.round(power / ef), avg_power_w: power - 10, normalized_power_w: power, avg_cadence_rpm: cadence };
}

describe("Rolle gegen Straße", () => {
  it("Umgebung erkennen", () => {
    expect(environmentOf({ source: "mywhoosh", sport: "cycling", distance_m: 30000 })).toBe("indoor");
    expect(environmentOf({ source: "wahoo", sources: ["wahoo", "whoop"], sport: "cycling", distance_m: 40000 })).toBe("outdoor");
    expect(environmentOf({ source: "whoop", sport: "Indoor Cycling", distance_m: null })).toBe("indoor");
    expect(environmentOf({ source: "whoop", sport: "cycling", distance_m: null })).toBeNull();
  });

  it("höherer Puls auf der Rolle", () => {
    const ws = [...Array.from({ length: 5 }, (_, k) => ride(k, false, 1.4, 92)), ...Array.from({ length: 4 }, (_, k) => ride(k + 5, true, 1.5, 84))];
    const r = indoorOutdoor(ws, 280, TODAY, 90);
    expect(r.indoor.rides).toBe(5);
    expect(r.outdoor.rides).toBe(4);
    expect(r.comparison!.refPowerW).toBe(200);
    expect(r.comparison!.hrGap).toBe(10);
    expect(r.comparison!.cadenceGap).toBe(8);
    expect(r.hints[0]).toMatch(/Rolle.*10 Schläge höher/);
    expect(r.hints[1]).toMatch(/8 U\/min schneller/);
    expect(analysisHighlights({ indoorOutdoor: r }).highlights[0].topic).toBe("indoorOutdoor");
  });

  it("nur Rolle: kein Vergleich, Hinweis auf fehlende Fahrten draußen", () => {
    const r = indoorOutdoor(Array.from({ length: 6 }, (_, k) => ride(k, false, 1.4, 90)), null, TODAY, 90);
    expect(r.comparison).toBeNull();
    expect(r.hints[0]).toMatch(/draußen.*bisher drinnen 6, draußen 0/);
    expect(r.hints[1]).toMatch(/wieder draußen/);
    expect(analysisHighlights({ indoorOutdoor: r }).highlights).toHaveLength(0);
  });
});
