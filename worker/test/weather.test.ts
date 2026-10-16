import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { bestWindow, parseForecast, parseGeocode, rideAdvice, scoreHour } from "../src/core/weather";
import type { Env } from "../src/env";
import { registerWeatherTools } from "../src/weather-tools";
import { fakeD1 } from "./fake-d1";

// Synthetische Vorhersage im Format der Open-Meteo-API: tagsüber 7–18 Uhr, mittags trocken und mild, ab 16 Uhr Regen.
function forecast(day: string, opts: { temp?: number; wind?: number } = {}) {
  const time: string[] = [], t: number[] = [], p: number[] = [], mm: number[] = [], w: number[] = [], g: number[] = [], c: number[] = [], d: number[] = [];
  for (const dd of [day, addDays(day, 1)]) for (let h = 0; h < 24; h++) {
    time.push(`${dd}T${String(h).padStart(2, "0")}:00`);
    t.push((opts.temp ?? 16) + (h >= 11 && h <= 15 ? 3 : 0));
    const rain = h >= 16;
    p.push(rain ? 80 : 10); mm.push(rain ? 1.2 : 0); w.push(opts.wind ?? 10); g.push(20); c.push(rain ? 61 : 1); d.push(h >= 7 && h <= 18 ? 1 : 0);
  }
  return { hourly: { time, temperature_2m: t, precipitation_probability: p, precipitation: mm, wind_speed_10m: w, wind_gusts_10m: g, weather_code: c, is_day: d } };
}

describe("Wetter-Bewertung (#66)", () => {
  it("bewertet Stunden nach Temperatur, Regen, Wind und Tageslicht", () => {
    const base = { time: "x", tempC: 18, rainProb: 0, rainMm: 0, windKmh: 5, gustKmh: 10, code: 1, isDay: true };
    expect(scoreHour(base).score).toBe(100);
    expect(scoreHour({ ...base, isDay: false }).score).toBe(0);
    expect(scoreHour({ ...base, tempC: 1 }).score).toBe(0);
    expect(scoreHour({ ...base, rainMm: 2 }).score).toBe(20);
    expect(scoreHour({ ...base, windKmh: 30 }).issues).toContain("starker Wind");
    expect(scoreHour({ ...base, code: 95 }).score).toBe(0);
  });

  it("findet das beste Fenster vor dem Regen und lässt vergangene Stunden aus", () => {
    const hours = parseForecast(forecast("2026-04-01"));
    const w = bestWindow(hours, "2026-04-01", 3)!;
    expect(w.rating).toBe("gut");
    expect(Number(w.start.slice(11, 13))).toBeGreaterThanOrEqual(7);
    expect(Number(w.end.slice(11, 13))).toBeLessThanOrEqual(16);
    expect(w.rainProbMax).toBe(10);
    expect(bestWindow(hours, "2026-04-01", 2, "2026-04-01T17:00")?.rating ?? "schlecht").toBe("schlecht");
  });

  it("Empfehlung: Grundlage draußen, Intervalle auf der Rolle, Ruhetag bleibt Ruhetag", () => {
    const w = bestWindow(parseForecast(forecast("2026-04-01")), "2026-04-01", 2);
    expect(rideAdvice(w, { type: "endurance", title: "Grundlage" }, "moderate").verdict).toBe("outside");
    expect(rideAdvice(w, { type: "threshold", title: "Schwelle" }, "hard").verdict).toBe("indoor");
    expect(rideAdvice(w, { type: "strength", title: "Kraft" }, "hard").verdict).toBe("no_ride");
    expect(rideAdvice(w, null, "rest").verdict).toBe("rest");
    const cold = bestWindow(parseForecast(forecast("2026-04-01", { temp: 0 })), "2026-04-01", 2);
    expect(rideAdvice(cold, { type: "endurance", title: "Grundlage" }, "moderate").verdict).toBe("indoor");
  });

  it("Geocoding: erster Treffer, auf eine Nachkommastelle gerundet", () => {
    expect(parseGeocode({ results: [{ name: "Graz", latitude: 47.0707, longitude: 15.4395, admin1: "Steiermark", country: "Österreich" }] }))
      .toEqual({ name: "Graz, Steiermark, Österreich", lat: 47.1, lon: 15.4 });
    expect(parseGeocode({})).toBeNull();
  });
});

describe("Wetter-Werkzeuge", () => {
  function tools(fetchJson: (url: string) => Promise<unknown>) {
    const server = new McpServer({ name: "t", version: "0" });
    const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>>();
    const orig = server.registerTool.bind(server);
    (server as unknown as { registerTool: unknown }).registerTool = (name: string, cfg: unknown, cb: never) => (handlers.set(name, cb), orig(name, cfg as never, cb));
    registerWeatherTools(server, { DB: fakeD1() } as unknown as Env, fetchJson);
    return async (name: string, args: Record<string, unknown> = {}) => {
      const r = await handlers.get(name)!(args);
      return { error: r.isError ?? false, value: JSON.parse(r.content[0].text) };
    };
  }

  it("ohne Ort Hinweis, mit Ort zwei Tage mit Empfehlung", async () => {
    const urls: string[] = [];
    const call = tools(async (url) => {
      urls.push(url);
      if (url.includes("geocoding")) return { results: [{ name: "Graz", latitude: 47.07, longitude: 15.44, country: "Österreich" }] };
      const today = new Date().toISOString().slice(0, 10);
      return forecast(addDays(today, -1));
    });
    expect((await call("get_ride_weather")).value.error).toBe("no_location");
    expect((await call("set_weather_location", { name: "Graz" })).value.location).toEqual({ name: "Graz, Österreich", lat: 47.1, lon: 15.4 });
    const r = await call("get_ride_weather");
    expect(r.error).toBe(false);
    expect(r.value.days).toHaveLength(2);
    expect(r.value.days[0].advice.text).toBeTruthy();
    expect(urls.at(-1)).toContain("latitude=47.1&longitude=15.4");
    expect((await call("set_weather_location", { name: "Nirgendwo" })).error).toBe(false); // gleicher Fake findet immer Graz
  });
});
