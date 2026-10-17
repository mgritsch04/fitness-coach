import { describe, expect, it } from "vitest";
import { clothingAdvice, feelsLikeOnBike, type RideWindow, type WeatherHour } from "../src/core/weather";

// Synthetische Wetterstunden, keine echten Daten.
const DAY = "2026-04-01";
const hour = (h: number, tempC: number, o: Partial<WeatherHour> = {}): WeatherHour => ({
  time: `${DAY}T${String(h).padStart(2, "0")}:00`, tempC, rainProb: 0, rainMm: 0, windKmh: 10, gustKmh: 15, code: 1, isDay: h >= 7 && h <= 19, score: 80, issues: [], ...o,
});
const win = (hours: WeatherHour[], from: number, n: number): RideWindow => {
  const w = hours.filter((h) => Number(h.time.slice(11, 13)) >= from && Number(h.time.slice(11, 13)) < from + n);
  const t = w.map((h) => h.tempC!);
  return { start: w[0].time, end: `${DAY}T${String(from + n).padStart(2, "0")}:00`, hours: n, score: 80, rating: "gut",
    tempMin: Math.min(...t), tempMax: Math.max(...t), rainProbMax: Math.max(...w.map((h) => h.rainProb ?? 0)), windMax: Math.max(...w.map((h) => h.windKmh ?? 0)), issues: [] };
};
const day = (temp: (h: number) => number, o: (h: number) => Partial<WeatherHour> = () => ({})) => Array.from({ length: 24 }, (_, h) => hour(h, temp(h), o(h)));

describe("gefühlte Temperatur auf dem Rad", () => {
  it("Fahrtwind kühlt deutlich, mehr Wind kühlt mehr", () => {
    expect(feelsLikeOnBike(10, 0)).toBeLessThan(8);
    expect(feelsLikeOnBike(10, 30)).toBeLessThan(feelsLikeOnBike(10, 0));
    expect(feelsLikeOnBike(25, 10)).toBe(23);
    // ohne großen Sprung an der Grenze 15 °C
    expect(Math.abs(feelsLikeOnBike(15, 10) - feelsLikeOnBike(15.1, 10))).toBeLessThan(1.5);
  });
});

describe("Kleidungsstufen", () => {
  const level = (t: number) => { const hs = day(() => t); return clothingAdvice(win(hs, 10, 2), hs)!; };
  it("je wärmer, desto weniger", () => {
    expect(level(28).level).toBe(1);
    expect(level(18).level).toBe(2);
    expect(level(14).level).toBe(3);
    expect(level(9).level).toBe(4);
    expect(level(4).level).toBe(5);
    expect(level(-3).level).toBe(6);
    expect(level(9).items).toContain("Überschuhe");
    expect(level(28).items).toEqual(["Kurzarmtrikot", "kurze Radhose"]);
  });

  it("Regen: Jacke an oder einstecken", () => {
    const wet = day(() => 16, (h) => (h >= 10 ? { rainProb: 70, rainMm: 1 } : {}));
    expect(clothingAdvice(win(wet, 10, 2), wet)!.items).toContain("Regenjacke");
    const maybe = day(() => 16, () => ({ rainProb: 30 }));
    expect(clothingAdvice(win(maybe, 10, 2), maybe)!.items).toContain("Regenjacke in die Trikottasche");
  });

  it("Schichten bei steigender Temperatur, Licht am Abend, Glätte, Hitze", () => {
    const rising = day((h) => -5 + 2 * h);
    const c = clothingAdvice(win(rising, 7, 4), rising)!;
    expect(c.level).toBe(4);
    expect(c.hints.some((x) => x.includes("Schichten"))).toBe(true);
    const evening = day(() => 18);
    expect(clothingAdvice(win(evening, 17, 3), evening)!.items).toContain("Front- und Rücklicht");
    expect(clothingAdvice(win(evening, 10, 3), evening)!.items).not.toContain("Front- und Rücklicht");
    const cold = day(() => 1);
    expect(clothingAdvice(win(cold, 11, 2), cold)!.hints.join(" ")).toContain("Glätte");
    const hot = day(() => 30);
    expect(clothingAdvice(win(hot, 11, 2), hot)!.hints.join(" ")).toContain("zwei Flaschen");
  });

  it("ohne Fenster keine Empfehlung", () => {
    expect(clothingAdvice(null, [])).toBeNull();
  });
});
