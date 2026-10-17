import { describe, expect, it } from "vitest";
import { DEFAULT_WPRIME_KJ, wbalModel, wbalReport, wbalSeries } from "../src/core/wbal";
import { sessionQuality } from "../src/core/intervals";

// Synthetische Leistungsreihen, keine echten Messwerte.
const model = { cpW: 250, wPrimeKj: 20, source: "cp" as const };

describe("W′-Bilanz", () => {
  it("handgerechnetes Beispiel", () => {
    // 10 s mit 350 W: 20000 − 10 · 100 = 19000 J; dann 1 s mit 150 W: + (20000 − 19000) · 100 / 20000 = 5 J.
    const s = wbalSeries([...Array(10).fill(350), 150], model);
    expect(s[9]).toBe(19000);
    expect(s[10]).toBeCloseTo(19005, 6);
    // Fehlende Werte zählen als 0 W (Erholung), nie über W′ und nie unter 0.
    expect(wbalSeries([null, 0], model).every((v) => v === 20000)).toBe(true);
    expect(Math.min(...wbalSeries(Array(300).fill(400), model))).toBe(0);
  });

  it("Bericht: tiefster Wert, Raster, Urteil", () => {
    // 5 × 3 min mit 330 W (je 14,4 kJ über CP), 3 min Pause mit 120 W.
    const power = [...Array(600).fill(150)];
    for (let k = 0; k < 5; k++) power.push(...Array(180).fill(330), ...Array(180).fill(120));
    const r = wbalReport(power, model, 10)!;
    expect(r.minPct).toBeLessThan(40);
    expect(r.minAtS).toBeGreaterThan(600);
    expect(r.series).toHaveLength(Math.ceil(power.length / 10));
    expect(Math.min(...r.series)).toBe(r.minKj);
    expect(r.verdict).toMatch(/geleert|deutlich/);
    expect(wbalReport(Array(600).fill(200), model)!.verdict).toMatch(/kaum genutzt/);
    expect(wbalReport(null, model)).toBeNull();
  });

  it("Modell: CP aus Bestwerten, sonst FTP mit angenommenem W′", () => {
    expect(wbalModel({ cpW: 270, wPrimeKj: 18, confidence: "medium" }, 260)).toEqual({ cpW: 270, wPrimeKj: 18, source: "cp" });
    expect(wbalModel({ cpW: 270, wPrimeKj: 40, confidence: "low" }, 260)).toEqual({ cpW: 260, wPrimeKj: DEFAULT_WPRIME_KJ, source: "ftp" });
    expect(wbalModel(null, null)).toBeNull();
  });

  it("Intervall-Qualität zeigt den tiefsten W′-Stand", () => {
    const power: number[] = [...Array(600).fill(150)];
    for (let k = 0; k < 5; k++) power.push(...Array(240).fill(320), ...Array(120).fill(120));
    const ride = { day: "2026-04-01", source: "mywhoosh", sourceId: "w1", power, heartRate: null, cadence: null };
    const q = sessionQuality(ride, 260, model)!;
    expect(q.wbalMinPct).not.toBeNull();
    expect(q.wbalMinPct!).toBeLessThan(50);
    expect(sessionQuality(ride, 260)!.wbalMinPct).toBeNull();
  });
});
