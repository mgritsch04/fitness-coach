import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { registerBikeWorkoutTools } from "../src/bike-workout-tools";
import { CATEGORY_LABELS, LIBRARY, pickWorkouts, suitsReadiness, templateWorkout, toZwo, zwoFileName } from "../src/core/bike-workout";
import type { Env } from "../src/env";
import { fakeD1 } from "./fake-d1";

const ALLOWED = /^ {4}<(Warmup Duration="\d+" PowerLow="\d\.\d\d" PowerHigh="\d\.\d\d"|Cooldown Duration="\d+" PowerLow="\d\.\d\d" PowerHigh="\d\.\d\d"|SteadyState Duration="\d+" Power="\d\.\d\d"|IntervalsT Repeat="\d+" OnDuration="\d+" OffDuration="\d+" OnPower="\d\.\d\d" OffPower="\d\.\d\d")\/>$/;

describe("Workout-Bibliothek", () => {
  it("3–4 Stufen je Art, eindeutige IDs", () => {
    expect(new Set(LIBRARY.map((t) => t.id)).size).toBe(LIBRARY.length);
    for (const c of Object.keys(CATEGORY_LABELS)) {
      const levels = LIBRARY.filter((t) => t.category === c).map((t) => t.level);
      expect(levels.length).toBeGreaterThanOrEqual(3);
      expect(levels.length).toBeLessThanOrEqual(4);
      expect(levels).toEqual([...levels].sort());
    }
  });

  it("jede Vorlage ergibt eine gültige ZWO-Datei", () => {
    for (const t of LIBRARY) {
      const w = templateWorkout(t), zwo = toZwo(w), lines = zwo.split("\n");
      expect(lines[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
      const body = lines.slice(lines.indexOf("  <workout>") + 1, lines.indexOf("  </workout>"));
      expect(body.length).toBe(w.steps.length);
      for (const l of body) expect(l).toMatch(ALLOWED);
      // Dauer der Schritte = Summe in der Datei, Leistungen plausibel
      const secs = body.reduce((a, l) => {
        const rep = Number(l.match(/Repeat="(\d+)"/)?.[1] ?? 1), on = Number(l.match(/OnDuration="(\d+)"/)?.[1] ?? 0), off = Number(l.match(/OffDuration="(\d+)"/)?.[1] ?? 0);
        return a + (l.includes("IntervalsT") ? rep * (on + off) : Number(l.match(/Duration="(\d+)"/)![1]));
      }, 0);
      expect(secs).toBe(w.durationMin * 60);
      for (const p of zwo.matchAll(/Power\w*="([\d.]+)"/g)) expect(Number(p[1])).toBeGreaterThan(0.3), expect(Number(p[1])).toBeLessThan(1.4);
      expect(zwo.split("<").length).toBe(zwo.split(">").length);
      expect(w.intensityFactor).toBeGreaterThan(0.4);
      expect(w.intensityFactor).toBeLessThan(1.05);
    }
  });

  it("Dateiname aus der Vorlage", () => {
    const w = templateWorkout(LIBRARY.find((t) => t.id === "ss-2x20")!);
    expect(zwoFileName(w, "2026-04-01")).toBe(`2026-04-01-sweet-spot-2-20-${w.durationMin}min.zwo`);
  });

  it("Tagesform: rot nur locker, gelb ohne VO2max und Stufe 4, grün alles", () => {
    expect(suitsReadiness({ category: "vo2max", level: 1 }, 20)).toBe(false);
    expect(suitsReadiness({ category: "recovery", level: 2 }, 20)).toBe(true);
    expect(suitsReadiness({ category: "vo2max", level: 1 }, 50)).toBe(false);
    expect(suitsReadiness({ category: "threshold", level: 3 }, 50)).toBe(true);
    expect(suitsReadiness({ category: "threshold", level: 4 }, 50)).toBe(false);
    expect(suitsReadiness({ category: "vo2max", level: 4 }, 80)).toBe(true);
  });

  it("Auswahl nach Zeit und Art, passende zuerst", () => {
    const r = pickWorkouts({ maxMin: 60, recovery: 25 });
    expect(r.items.every((x) => x.durationMin <= 60)).toBe(true);
    expect(r.items[0].suited).toBe(true);
    const flags = r.items.map((x) => x.suited);
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    expect(flags).toContain(false);
    expect(r.hint).toContain("rot");
    expect(pickWorkouts({ category: "threshold" }).items.map((x) => x.id)).toEqual(["th-4x8", "th-3x12", "th-ou", "th-2x20"]);
  });
});

describe("Werkzeuge", () => {
  function tools() {
    const server = new McpServer({ name: "t", version: "0" });
    const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>>();
    const orig = server.registerTool.bind(server);
    (server as unknown as { registerTool: unknown }).registerTool = (name: string, cfg: unknown, cb: never) => {
      handlers.set(name, cb);
      return orig(name, cfg as never, cb);
    };
    registerBikeWorkoutTools(server, { DB: fakeD1() } as unknown as Env);
    return async (name: string, args: Record<string, unknown> = {}) => {
      const r = await handlers.get(name)!(args);
      return { error: r.isError ?? false, value: JSON.parse(r.content[0].text) };
    };
  }

  it("list_bike_workouts und get_bike_workout mit templateId", async () => {
    const call = tools();
    const list = await call("list_bike_workouts", { maxMin: 70, category: "vo2max" });
    expect(list.error).toBe(false);
    expect(list.value.items.length).toBeGreaterThan(0);
    expect(list.value.recovery).toBeNull();
    const r = await call("get_bike_workout", { templateId: "vo-30-30", day: "2026-03-31" });
    expect(r.error).toBe(false);
    expect(r.value.workout.templateId).toBe("vo-30-30");
    expect(r.value.fileName).toMatch(/^2026-03-31-30-30-\d+min\.zwo$/);
    expect(r.value.zwo.match(/<IntervalsT/g)).toHaveLength(2);
  });
});
