import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { buildDashboard } from "../src/core/dashboard";
import { indoorState, readIndoor, writeIndoor } from "../src/core/indoor";
import { buildWeekPlan, DEFAULT_PREFS, type PlanInput } from "../src/core/plan";
import type { Env } from "../src/env";
import { registerWeatherTools } from "../src/weather-tools";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch, keine echten Messwerte.
describe("Winterbetrieb (#326)", () => {
  it("Zustand mit Enddatum", () => {
    expect(indoorState({ on: true, until: null }, "2026-01-10").active).toBe(true);
    expect(indoorState({ on: true, until: "2026-03-31" }, "2026-03-31").active).toBe(true);
    expect(indoorState({ on: true, until: "2026-03-31" }, "2026-04-01").active).toBe(false);
    expect(indoorState({ on: false, until: null }, "2026-01-10").active).toBe(false);
  });

  it("speichern und lesen", async () => {
    const db = fakeD1() as unknown as D1Database;
    expect(await readIndoor(db)).toEqual({ on: false, until: null });
    await writeIndoor(db, { on: true, until: "2027-03-15" });
    expect(await writeIndoor(db, { until: null })).toEqual({ on: true, until: null });
  });

  it("Wochenplan beschreibt Radeinheiten für die Rolle", () => {
    const input = (indoor: boolean): PlanInput => ({ weekStart: "2026-03-02", goals: [], prefs: { ...DEFAULT_PREFS, weeklyHours: 7 }, weeks: [], ctl: 45, tsb: -5, ftpW: 250, thresholdHr: 165, maxHr: 185, indoor });
    const rides = (p: ReturnType<typeof buildWeekPlan>) => p.days.filter((d) => ["endurance", "long", "tempo", "recovery"].includes(d.type));
    const on = rides(buildWeekPlan(input(true)));
    expect(on.length).toBeGreaterThan(0);
    for (const d of on) { expect(d.description).toContain("Rolle"); expect(d.description).not.toContain("draußen"); }
    expect(rides(buildWeekPlan(input(false))).some((d) => d.description.includes("Auf der Rolle"))).toBe(false);
  });

  it("Radwetter rät nicht zum Fahren draußen, keine Kleidung; Tagesempfehlung nennt die Rolle", async () => {
    const db = fakeD1();
    const server = new McpServer({ name: "t", version: "0" });
    const handlers = new Map<string, (a: Record<string, unknown>) => Promise<{ content: { text: string }[] }>>();
    const orig = server.registerTool.bind(server);
    (server as unknown as { registerTool: unknown }).registerTool = (name: string, cfg: unknown, cb: never) => (handlers.set(name, cb), orig(name, cfg as never, cb));
    // Mildes, trockenes Wetter den ganzen Tag: ohne Winterbetrieb wäre draußen möglich.
    registerWeatherTools(server, { DB: db } as unknown as Env, async (url) => {
      if (url.includes("geocoding")) return { results: [{ name: "Graz", latitude: 47.07, longitude: 15.44, country: "Österreich" }] };
      const time: string[] = [];
      const today = new Date().toISOString().slice(0, 10);
      for (const d of [addDays(today, -1), today, addDays(today, 1), addDays(today, 2)]) for (let h = 0; h < 24; h++) time.push(`${d}T${String(h).padStart(2, "0")}:00`);
      const n = time.length, f = (v: number) => Array(n).fill(v);
      return { hourly: { time, temperature_2m: f(18), precipitation_probability: f(0), precipitation: f(0), wind_speed_10m: f(5), wind_gusts_10m: f(10), weather_code: f(1), is_day: time.map((t) => (+t.slice(11, 13) >= 7 && +t.slice(11, 13) <= 18 ? 1 : 0)) } };
    });
    const call = async (name: string, a: Record<string, unknown> = {}) => JSON.parse((await handlers.get(name)!(a)).content[0].text);
    await call("set_weather_location", { name: "Graz" });
    await writeIndoor(db as unknown as D1Database, { on: true, until: null });
    const r = await call("get_ride_weather");
    expect(r.indoor.active).toBe(true);
    for (const d of r.days) {
      expect(d.advice.verdict).not.toBe("outside");
      expect(d.clothing).toBeNull();
    }
    const dash = await buildDashboard(db as unknown as D1Database, { days: 14 });
    expect(dash.indoor.active).toBe(true);
    if (dash.coach.readiness !== "rest") expect(dash.coach.suggestion).toContain("Rolle");
  });
});
