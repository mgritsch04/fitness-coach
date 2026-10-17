import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import type { PlannedSession } from "../src/core/plan";
import type { Night } from "../src/core/sleep";
import { sleepTarget } from "../src/core/sleep-need";

const TODAY = "2026-03-25"; // Mittwoch → morgen Donnerstag (Wochentag)
const night = (day: string, asleepH: number, wake = "06:30", efficiencyPct = 90): Night => ({
  day, bedtime: null, wake, inBedH: null, asleepH, awakeH: null, lightH: null, deepH: null, remH: null, deepPct: null, remPct: null,
  efficiencyPct, performancePct: null, consistencyPct: null, respiratoryRate: null, napH: 0, debt7dH: null,
});
const point = (day: string, o: Partial<DayPoint>): DayPoint => ({
  day, recovery: 50, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: 8, sleepH: 8, sleepPerf: null, sleepEff: null, deepH: null, remH: null, respRate: null,
  load: 30, ctl: 40, atl: 40, tsb: 0, workouts: 1, trainingMin: 60, ...o,
});
const days = (n: number, f: (day: string, i: number) => Partial<DayPoint>) => Array.from({ length: n }, (_, i) => { const day = addDays(TODAY, -(n - 1 - i)); return point(day, f(day, i)); });
const hard: PlannedSession = { day: addDays(TODAY, 1), type: "threshold", title: "Schwelle 3×10", durationMin: 75, targetLoad: 90, intensity: "", description: "", key: true, strength: null };

describe("sleepTarget", () => {
  it("ohne eigene Daten: Bedarf aus den Einstellungen, Zubettgehzeit aus Aufwachzeit und Effizienz", () => {
    const nights = Array.from({ length: 10 }, (_, i) => night(addDays(TODAY, -i), 8));
    const t = sleepTarget({ today: TODAY, nights, series: days(10, () => ({ sleepH: 8 })), sleepNeedH: 8, tomorrow: null });
    expect(t.base.source).toBe("setting");
    expect(t.targetText).toBe("8 h");
    // 480 min / 0,9 = 533 → 535 min im Bett; 06:30 − 8:55 = 21:35.
    expect(t.inBedH).toBeCloseTo(8.92, 2);
    expect(t.wake).toBe("06:30");
    expect(t.bedtime).toBe("21:35");
    expect(t.parts).toEqual([]);
  });
  it("eigener Grundbedarf aus Nächten vor guter Erholung", () => {
    // 20 Nächte: vor guten Tagen (Erholung 80) 8,5 h, sonst 6,5 h.
    const nights = Array.from({ length: 20 }, (_, i) => night(addDays(TODAY, -i), i % 2 ? 8.5 : 6.5));
    const series = days(20, (day, i) => ({ recovery: (19 - i) % 2 ? 80 : 40, sleepH: 8.5 }));
    const t = sleepTarget({ today: TODAY, nights, series, sleepNeedH: 8, tomorrow: null });
    expect(t.base).toEqual({ hours: 8.5, source: "own", nights: 10 });
    expect(t.note).toContain("10 Nächten");
  });
  it("Zuschläge für Belastung, Schlafschuld und harte Einheit morgen", () => {
    const nights = Array.from({ length: 10 }, (_, i) => night(addDays(TODAY, -i), 6));
    // 7 Nächte à 6 h bei 8 h Bedarf = 14 h Schuld → höchstens 60 min.
    const series = days(10, (day) => (day === TODAY ? { sleepH: 6, load: 110, strain: 16 } : { sleepH: 6 }));
    const t = sleepTarget({ today: TODAY, nights, series, sleepNeedH: 8, tomorrow: hard });
    expect(t.parts.map((p) => p.minutes)).toEqual([20, 60, 15]);
    expect(t.targetText).toBe("9 h 35 min");
    expect(t.text).toContain("morgen Schwelle 3×10");
  });
  it("Wochenende: Aufwachzeit aus Wochenend-Nächten", () => {
    const fri = "2026-03-27"; // morgen Samstag
    const nights = Array.from({ length: 14 }, (_, i) => { const day = addDays(fri, -i); const we = [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()); return night(day, 8, we ? "08:30" : "06:30"); });
    const t = sleepTarget({ today: fri, nights, series: days(10, () => ({})), sleepNeedH: 8, tomorrow: null });
    expect(t.wake).toBe("08:30");
  });
  it("ohne Nächte keine Zubettgehzeit", () => {
    const t = sleepTarget({ today: TODAY, nights: [], series: [], sleepNeedH: 7.5, tomorrow: null });
    expect(t.bedtime).toBeNull();
    expect(t.targetText).toBe("7 h 30 min");
  });
});
