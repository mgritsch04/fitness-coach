import { describe, expect, it } from "vitest";
import { cadenceReport } from "../src/core/cadence";
import type { IntervalRide } from "../src/core/intervals";

// Synthetische Sekundenreihen, keine echten Messwerte.
const TODAY = "2026-04-30";
const FTP = 300;
/** Abschnitte [Sekunden, Watt, U/min] hintereinander. */
function ride(day: string, parts: [number, number, number][]): IntervalRide {
  const power: number[] = [], cadence: number[] = [];
  for (const [n, p, c] of parts) for (let t = 0; t < n; t++) { power.push(p); cadence.push(c); }
  return { day, source: "mywhoosh", sourceId: day, power, heartRate: null, cadence };
}

describe("Trittfrequenz-Profil", () => {
  it("Verteilung und Median je Zone", () => {
    // 40 min Z2 (200 W) mit 85, 10 min Schwelle (300 W) mit 76, 2 min Rollen ohne Tritt
    const r = cadenceReport([ride("2026-04-20", [[2400, 200, 85], [600, 300, 76], [120, 0, 0]])], FTP, TODAY, 90);
    expect(r.pedalingMinutes).toBe(50);
    expect(r.bands.find((b) => b.key === "80to90")!.sharePct).toBe(80);
    expect(r.bands.find((b) => b.key === "70to80")!.sharePct).toBe(20);
    expect(r.zones![1].medianRpm).toBe(85);
    expect(r.zones![3].medianRpm).toBe(76);
    expect(r.zones![0].medianRpm).toBeNull();
    expect(r.hints[0]).toMatch(/Schwelle trittst du im Mittel nur 76/);
  });

  it("Verlauf in Zone 2 je Woche", () => {
    const rides = [0, 1, 2, 3].map((k) => ride(`2026-04-${String(6 + k * 7).padStart(2, "0")}`, [[1800, 200, 78 + k * 3]]));
    const r = cadenceReport(rides, FTP, TODAY, 90);
    expect(r.weeks.map((w) => w.medianRpm)).toEqual([78, 81, 84, 87]);
    expect(r.hints.join(" ")).toMatch(/um etwa 6 U\/min gestiegen/);
  });

  it("ohne FTP und ohne Daten", () => {
    const noFtp = cadenceReport([ride("2026-04-20", [[1800, 200, 90]])], null, TODAY, 90);
    expect(noFtp.zones).toBeNull();
    expect(noFtp.hints[0]).toMatch(/Ohne FTP/);
    expect(cadenceReport([], FTP, TODAY, 90).hints[0]).toMatch(/Noch keine Fahrten/);
  });
});
