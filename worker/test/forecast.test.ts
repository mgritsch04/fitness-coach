import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import { crossValidate, fit, lateTrainingDays, observations, recoveryForecast } from "../src/core/forecast";

// Synthetischer Verlauf mit bekanntem Zusammenhang, keine echten Messwerte.
const TODAY = "2026-04-30";
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const point = (day: string, o: Partial<DayPoint>): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0, ...o,
});

/** Erholung = 20 + 0,3 · Vortag + 8 · (Schlaf − 7) · … − 0,15 · Belastung + Rauschen (±noise). */
function history(days: number, noise: number, seed = 1) {
  const r = rng(seed);
  const out: DayPoint[] = [];
  let prev = 60;
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(TODAY, -i);
    const load = r() < 0.4 ? 0 : 40 + r() * 120;
    const sleepH = 6 + r() * 2.5;
    const prevLoad = out.at(-1)?.load ?? 0;
    const recovery = Math.max(1, Math.min(99, 20 + 0.3 * prev + 8 * (sleepH - 7) + 25 - 0.15 * prevLoad + (r() - 0.5) * 2 * noise));
    out.push(point(day, { recovery, load, strain: 6 + load * 0.08, sleepH }));
    prev = recovery;
  }
  return out;
}

describe("Erholungs-Prognose", () => {
  it("lernt die Zusammenhänge aus dem Verlauf", () => {
    const obs = observations(history(90, 3), new Set(), addDays(TODAY, -89), TODAY);
    expect(obs.length).toBeGreaterThan(80);
    const m = fit(obs, 0.01);
    expect(m.coef.sleepH).toBeGreaterThan(6);
    expect(m.coef.sleepH).toBeLessThan(10);
    // Belastung und Strain hängen hier fest zusammen; zusammen ergeben sie etwa −0,15 je Belastungspunkt.
    expect(m.coef.load + 0.08 * m.coef.strain).toBeCloseTo(-0.15, 1);
    const cv = crossValidate(obs);
    expect(cv.mae).toBeLessThan(cv.maeMean);
    expect(cv.mae).toBeLessThan(4);
  });

  it("liefert Prognose mit Spanne und Was-wäre-wenn", () => {
    const f = recoveryForecast(history(90, 3), new Set(), TODAY, { sleepH: 7 });
    expect(f.available).toBe(true);
    if (!f.available) return;
    expect(f.tomorrow).toBe("2026-05-01");
    expect(f.forecast.low).toBeLessThanOrEqual(f.forecast.recovery);
    expect(f.forecast.high).toBeGreaterThanOrEqual(f.forecast.recovery);
    const [more, less, evening] = f.scenarios;
    expect(more.delta).toBeGreaterThan(5);
    expect(less.delta).toBeLessThan(-5);
    expect(evening.delta).toBeLessThan(0);
    expect(f.quality.recent).toHaveLength(14);
  });

  it("geplantes Training am Abend: Szenario ohne Training ist besser", () => {
    const f = recoveryForecast(history(90, 3), new Set(), TODAY, { extraLoad: 100 });
    if (!f.available) throw new Error(f.reason);
    expect(f.assumptions.lateTraining).toBe(true);
    expect(f.scenarios[2].label).toMatch(/Kein Training/);
    expect(f.scenarios[2].delta).toBeGreaterThan(0);
  });

  it("zeigt nichts bei zu wenig Daten oder reinem Rauschen", () => {
    const few = recoveryForecast(history(20, 3), new Set(), TODAY);
    expect(few.available).toBe(false);
    expect(few.available ? "" : few.reason).toMatch(/zu wenige/);
    // Nur Zufall: Erholung ohne Bezug zu den Merkmalen
    const r = rng(7);
    const noise = history(90, 3).map((p) => ({ ...p, recovery: 10 + r() * 80 }));
    const f = recoveryForecast(noise, new Set(), TODAY);
    expect(f.available).toBe(false);
  });

  it("erkennt spätes Training nach 19 Uhr in der Zeitzone", () => {
    const late = lateTrainingDays(
      [
        { day: "2026-04-01", end_time: "2026-04-01T17:30:00Z" }, // 19:30 in Wien (Sommerzeit)
        { day: "2026-04-02", end_time: "2026-04-02T15:00:00Z" },
      ],
      "Europe/Vienna",
    );
    expect([...late]).toEqual(["2026-04-01"]);
  });
});
