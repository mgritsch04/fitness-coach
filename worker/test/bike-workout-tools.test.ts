import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { registerBikeWorkoutTools } from "../src/bike-workout-tools";
import { registerCoachTools } from "../src/coach-tools";
import type { Env } from "../src/env";
import { fakeD1 } from "./fake-d1";

// Werkzeuge direkt über die registrierten Handler aufrufen (ohne Transport). Synthetische Daten.
function tools() {
  const server = new McpServer({ name: "t", version: "0" });
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>>();
  const orig = server.registerTool.bind(server);
  (server as unknown as { registerTool: unknown }).registerTool = (name: string, cfg: unknown, cb: never) => {
    handlers.set(name, cb);
    return orig(name, cfg as never, cb);
  };
  const env = { DB: fakeD1() } as unknown as Env;
  registerCoachTools(server, env);
  registerBikeWorkoutTools(server, env);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await handlers.get(name)!(args);
    return { error: r.isError ?? false, value: JSON.parse(r.content[0].text) };
  };
  return { call };
}

describe("get_bike_workout", () => {
  it("baut eine Einheit aus Typ und Dauer mit ZWO-Datei", async () => {
    const { call } = tools();
    const r = await call("get_bike_workout", { type: "threshold", durationMin: 75, day: "2026-03-31" });
    expect(r.error).toBe(false);
    expect(r.value.fileName).toBe("2026-03-31-schwelle-75min.zwo");
    expect(r.value.zwo).toContain("<IntervalsT Repeat=\"3\"");
    expect(r.value.howTo.length).toBeGreaterThan(0);
  });

  it("nimmt die Planeinheit des Tages und meldet Tage ohne Rad", async () => {
    const { call } = tools();
    const ws = (await call("save_plan", { accept: true })).value.week as string;
    await call("save_plan", { days: [{ day: ws, type: "vo2max", durationMin: 60 }] });
    const ride = await call("get_bike_workout", { day: ws });
    expect(ride.value.planned.type).toBe("vo2max");
    expect(ride.value.workout.steps.some((s: { kind: string }) => s.kind === "intervals")).toBe(true);
    const rest = await call("get_bike_workout", { day: addDays(ws, 1) });
    expect(rest.error).toBe(true);
    expect(rest.value.error).toBe("no_ride");
  });
});
