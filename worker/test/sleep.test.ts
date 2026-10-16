import { describe, expect, it } from "vitest";
import { addDays, type SleepRow } from "../src/core/analysis";
import { sleepReport } from "../src/core/sleep";

// Synthetische Nächte, keine echten Messwerte. Berlin im Januar = UTC+1.

const night = (day: string, bedUtc: string, hours: number, o: Partial<SleepRow> = {}): SleepRow => {
  const start = Date.parse(`${addDays(day, -1)}T${bedUtc}:00Z`);
  const asleep = Math.round(hours * 3600);
  return {
    day, source: "whoop", start_time: new Date(start).toISOString(), end_time: new Date(start + asleep * 1000 + 1800_000).toISOString(), is_nap: 0,
    in_bed_s: asleep + 1800, asleep_s: asleep, awake_s: 1800, light_s: Math.round(asleep * 0.55), deep_s: Math.round(asleep * 0.2), rem_s: Math.round(asleep * 0.25),
    performance_pct: 80, efficiency_pct: 92, consistency_pct: 70, respiratory_rate: 15, ...o,
  };
};

describe("Schlaf-Detail", () => {
  const FROM = "2026-01-05"; // Montag
  // Wochentags 22:30 Berlin ins Bett und 6,5 h Schlaf, am Wochenende (Aufwachen Sa/So) 00:30 und 8 h.
  const sleeps: SleepRow[] = [];
  for (let i = 0; i < 14; i++) {
    const day = addDays(FROM, i);
    const dow = new Date(day + "T00:00:00Z").getUTCDay();
    const weekend = dow === 6 || dow === 0;
    sleeps.push(night(day, weekend ? "23:30" : "21:30", weekend ? 8 : 6.5));
  }
  sleeps.push({ ...night("2026-01-10", "12:00", 0.5), is_nap: 1 });
  const r = sleepReport(sleeps, "Europe/Berlin", FROM, addDays(FROM, 13), 8);

  it("listet Nächte mit Uhrzeiten und Phasen", () => {
    expect(r.nights).toHaveLength(14);
    expect(r.nights[0]).toMatchObject({ day: FROM, bedtime: "22:30", wake: "05:30", asleepH: 6.5, inBedH: 7, deepPct: 20, remPct: 25, napH: 0 });
    expect(r.nights.find((n) => n.day === "2026-01-10")).toMatchObject({ bedtime: "00:30", asleepH: 8, napH: 0.5 });
  });

  it("Schlafschuld über 7 Nächte", () => {
    // Letzte 7 Nächte: 5 × 6,5 h und 2 × 8 h → 5 × 1,5 h Schuld.
    expect(r.summary.debt7dH).toBe(7.5);
    expect(r.nights[0].debt7dH).toBe(1.5);
  });

  it("Zusammenfassung mit Wochenend-Verschiebung und Vorschlag", () => {
    expect(r.summary.nights).toBe(14);
    expect(r.summary.needMetPct).toBe(29); // 4 von 14 Nächten
    expect(r.summary.weekendShiftMin).toBeGreaterThan(150); // Schlafmitte am Wochenende gut 2,5 h später
    expect(r.summary.avgBedtime).toMatch(/^2[23]:\d\d$/);
    expect(r.summary.bedtimeSdMin!).toBeGreaterThan(50);
    expect(r.summary.suggestedBedtime).toMatch(/^\d\d:\d\d$/);
    expect(r.tips.join(" ")).toContain("Schlafschuld");
    expect(r.tips.join(" ")).toContain("Wochenende");
  });

  it("ohne Nächte leer, ohne Fehler", () => {
    const e = sleepReport([], "Europe/Berlin", FROM, FROM, 8);
    expect(e.nights).toEqual([]);
    expect(e.summary).toMatchObject({ nights: 0, avgAsleepH: null, suggestedBedtime: null, debt7dH: null });
    expect(e.tips).toEqual([]);
  });
});
