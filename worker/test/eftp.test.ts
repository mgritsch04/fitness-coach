import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { eftpFromRows, eftpTrend } from "../src/core/eftp";
import type { PowerBestRow } from "../src/core/performance";
import { analysisHighlights } from "../src/core/highlights";

// Synthetische Bestwerte, keine echten Messwerte.
const TODAY = "2026-04-30";
/** Eine harte Fahrt pro Woche über `weeks` Wochen; Faktor `f(k)` skaliert das Leistungsprofil. */
function rows(weeks: number, f: (k: number) => number, profile: [number, number][] = [[180, 360], [300, 330], [600, 305], [1200, 290]]): PowerBestRow[] {
  return Array.from({ length: weeks }, (_, k) => {
    const day = addDays(TODAY, -7 * (weeks - 1 - k) - 1);
    return profile.map(([d, w]) => ({ source: "mywhoosh", source_id: `r${k}`, day, duration_s: d, watts: Math.round(w * f(k)) }));
  }).flat();
}

describe("eFTP", () => {
  it("Critical Power, wenn das Modell passt", () => {
    const e = eftpFromRows(rows(4, () => 1), "2026-01-01", TODAY)!;
    expect(e.method).toBe("cp");
    expect(e.eftpW).toBeGreaterThan(270);
    expect(e.eftpW).toBeLessThan(290);
    expect(e.low).toBeLessThanOrEqual(e.eftpW);
    expect(e.high).toBeGreaterThanOrEqual(e.eftpW);
  });

  it("ohne 3–5 min: 95 % der besten 20 min, ohne 20 min: 90 % von 10 min", () => {
    expect(eftpFromRows(rows(2, () => 1, [[1200, 300]]), "2026-01-01", TODAY)).toMatchObject({ method: "20min", eftpW: 285 });
    expect(eftpFromRows(rows(2, () => 1, [[600, 300]]), "2026-01-01", TODAY)).toMatchObject({ method: "10min", eftpW: 270 });
    expect(eftpFromRows(rows(2, () => 1, [[60, 500]]), "2026-01-01", TODAY)).toBeNull();
  });

  it("steigende Form: Trend nach oben und Testvorschlag", () => {
    const r = eftpTrend({ rows: rows(20, (k) => 1 + k * 0.01), ftpW: 260, tests: [], weightKg: 75 }, TODAY, 12);
    if (!r.available) throw new Error(r.reason);
    expect(r.points).toHaveLength(12);
    expect(r.direction).toBe("up");
    expect(r.change!.w).toBeGreaterThan(0);
    expect(r.suggestTest).toBe(true);
    expect(r.deviationPct!).toBeGreaterThan(5);
    expect(r.current!.wattsPerKg).toBeCloseTo(r.current!.eftpW / 75, 2);
    expect(r.hints.at(-1)).toMatch(/über deiner eingestellten FTP \(260 W\)/);
    expect(analysisHighlights({ eftp: r }).highlights[0]).toMatchObject({ topic: "eftp", tone: "warn" });
  });

  it("fallende Form: Trend nach unten, ohne eingestellte FTP kein Test", () => {
    const r = eftpTrend({ rows: rows(20, (k) => 1.2 - k * 0.01), ftpW: null, tests: [{ day: addDays(TODAY, -10), ftpW: 280 }], weightKg: null }, TODAY, 12);
    if (!r.available) throw new Error(r.reason);
    expect(r.direction).toBe("down");
    expect(r.suggestTest).toBe(false);
    expect(r.points.some((p) => p.testW === 280)).toBe(true);
    expect(r.hints.some((h) => h.includes("gefallen"))).toBe(true);
    expect(r.hints.at(-1)).toMatch(/Keine FTP eingestellt/);
  });

  it("veralteter Bestwert und keine Daten", () => {
    const old = rows(3, () => 1).map((x) => ({ ...x, day: addDays(x.day, -30) }));
    const r = eftpTrend({ rows: old, ftpW: 250, tests: [], weightKg: null }, TODAY, 8);
    if (!r.available) throw new Error(r.reason);
    expect(r.current!.stale).toBe(true);
    expect(r.suggestTest).toBe(false);
    const none = eftpTrend({ rows: [], ftpW: 250, tests: [], weightKg: null }, TODAY, 8);
    expect(none.available).toBe(false);
    expect(analysisHighlights({ eftp: none }).highlights).toHaveLength(0);
  });
});
