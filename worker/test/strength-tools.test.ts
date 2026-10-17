import { describe, expect, it } from "vitest";
import { runBatched, upsertWorkout } from "../src/core/repository";
import type { Env } from "../src/env";
import { registerStrengthTools } from "../src/strength-tools";
import { fakeD1 } from "./fake-d1";

// Werkzeuge ohne MCP-Transport aufrufen: registerTool merkt sich nur die Handler.
function tools(db: D1Database) {
  const handlers = new Map<string, (input: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>>();
  const server = { registerTool: (name: string, _cfg: unknown, fn: never) => handlers.set(name, fn) };
  registerStrengthTools(server as never, { DB: db } as Env);
  return async (name: string, input: Record<string, unknown> = {}) => {
    const res = await handlers.get(name)!(input);
    return { ...JSON.parse(res.content[0].text), isError: res.isError ?? false };
  };
}

describe("Kraft-Werkzeuge", () => {
  it("erfassen, verknüpfen, Bestwerte, Vorlage und Überblick", async () => {
    const db = fakeD1();
    await runBatched(db, [
      upsertWorkout(db, {
        source: "whoop", sourceId: "w1", day: "2026-03-10", startTime: "2026-03-10T17:00:00.000Z", endTime: "2026-03-10T17:50:00.000Z",
        sport: "weightlifting", durationS: 3000, distanceM: null, energyKj: 1200, avgHr: 110, maxHr: 150, avgPowerW: null, normalizedPowerW: null, strain: 7,
      }),
    ]);
    const call = tools(db);

    const first = await call("log_strength_session", { day: "2026-03-03", durationMin: 50, rpe: 7, exercises: [{ exercise: "Kniebeuge", setCount: 3, reps: 5, weightKg: 100 }] });
    expect(first.exercises[0]).toMatchObject({ exercise: "back_squat", sets: 3, e1rmKg: 116.7, previousBestE1rmKg: null, newBest: false });

    const second = await call("log_strength_session", {
      day: "2026-03-10",
      rpe: 8,
      exercises: [{ exercise: "squat", sets: [{ reps: 5, weightKg: 105 }, { reps: 5, weightKg: 105 }] }, { exercise: "Sled Push", setCount: 2, reps: 1, weightKg: 80, muscles: ["quads"] }],
    });
    expect(second.linkedWorkout).toMatchObject({ source: "whoop", durationMin: 50 });
    expect(second.saved.durationMin).toBe(50);
    expect(second.load).toMatchObject({ value: 66.7, method: "srpe" });
    expect(second.exercises[0]).toMatchObject({ e1rmKg: 122.5, newBest: true });
    expect(second.unknownExercises).toEqual(["Sled Push"]);

    expect((await call("log_strength_session", { day: "2026-03-11", exercises: [{ exercise: "Kniebeuge" }] })).isError).toBe(true);
    expect((await call("log_strength_session", { day: "2026-03-11", template: "fehlt" })).error).toBe("template_not_found");

    await call("save_strength_template", { name: "Beine", exercises: [{ exercise: "Kniebeuge", sets: 2, reps: 5 }] });
    const suggestion = await call("suggest_strength_session", { template: "beine" });
    expect(suggestion.exercises[0]).toMatchObject({ exercise: "back_squat", weightKg: 110, basis: "increase" });
    const fromTemplate = await call("log_strength_session", { day: "2026-03-17", template: "Beine", rpe: 7, durationMin: 40 });
    expect(fromTemplate.saved).toMatchObject({ name: "Beine", sets: 2 });

    const overview = await call("get_strength", { weeks: 52 });
    expect(overview.sessions).toHaveLength(3);
    expect(overview.progress.find((p: { exercise: string }) => p.exercise === "back_squat").sessions).toBe(3);
    expect(overview.templates).toHaveLength(1);
    expect(overview.autoregulation.exercises).toEqual([]);
    // Express (#281): aus der Vorlage, passt schon in 30 min.
    const ex = await call("get_express_session", { minutes: 30, template: "Beine" });
    expect(ex.exercises[0]).toMatchObject({ exercise: "back_squat", sets: 2 });
    expect((await call("get_express_session", { minutes: 30 })).error).toBe("invalid_input");

    expect((await call("delete_strength_session", { id: fromTemplate.saved.id })).deleted).toBe(fromTemplate.saved.id);
    expect((await call("save_strength_template", { name: "Beine", delete: true })).deleted).toBe("Beine");
  });
});
