import { describe, expect, it } from "vitest";
import { comparePowerCurves, compareWindows } from "../src/core/power-compare";
import type { PowerBestRow } from "../src/core/performance";

// Synthetische Bestwerte, keine echten Messwerte.
const TODAY = "2026-04-30";
const ride = (id: string, day: string, f: number): PowerBestRow[] =>
  ([[5, 900], [60, 400], [300, 300], [1200, 260]] as const).map(([d, w]) => ({ source: "mywhoosh", source_id: id, day, duration_s: d, watts: Math.round(w * f) }));

describe("Leistungskurve Zeitraum gegen Zeitraum", () => {
  it("Fenster: vorheriger Zeitraum und Vorjahr", () => {
    expect(compareWindows("previous", TODAY, 90)).toEqual({ current: { from: "2026-01-31", to: TODAY }, reference: { from: "2025-11-02", to: "2026-01-30" } });
    expect(compareWindows("lastYear", TODAY, 90).reference).toEqual({ from: "2025-01-31", to: "2025-04-30" });
  });

  it("Differenz je Dauer und Hinweis bei Verbesserung", () => {
    const rows = [...ride("a", "2026-04-10", 1.05), ...ride("b", "2025-12-15", 1)];
    const r = comparePowerCurves(rows, "previous", TODAY, 90);
    const m5 = r.durations.find((d) => d.durationS === 300)!;
    expect(m5).toMatchObject({ currentW: 315, referenceW: 300, diffW: 15, diffPct: 5 });
    expect(r.durations.find((d) => d.durationS === 3600)!.currentW).toBeNull();
    expect(r.hints[0]).toContain("Stärker");
  });

  it("Fahrten im aktuellen Zeitraum zählen nicht als Bezug", () => {
    const r = comparePowerCurves(ride("a", "2026-04-10", 1), "previous", TODAY, 90);
    expect(r.durations.every((d) => d.referenceW == null)).toBe(true);
    expect(r.hints[0]).toContain("fehlen");
  });

  it("gemischt und gleich", () => {
    const now = ride("a", "2026-04-10", 1).map((x) => ({ ...x, watts: x.duration_s <= 60 ? x.watts * 0.9 : x.watts * 1.1 }));
    expect(comparePowerCurves([...now, ...ride("b", "2025-04-01", 1)], "lastYear", TODAY, 90).hints[0]).toContain("Gemischt");
    expect(comparePowerCurves([...ride("a", "2026-04-10", 1.01), ...ride("b", "2025-04-01", 1)], "lastYear", TODAY, 90).hints[0]).toContain("Etwa gleich");
  });

  it("ohne Daten", () => {
    expect(comparePowerCurves([], "previous", TODAY, 90).hints[0]).toContain("noch keine Fahrt");
  });
});
