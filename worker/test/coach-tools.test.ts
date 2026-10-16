import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { registerCoachTools } from "../src/coach-tools";
import type { Env } from "../src/env";
import { fakeD1 } from "./fake-d1";

// Ruft die Werkzeuge direkt über ihre registrierten Handler auf (ohne Transport). Synthetische Daten.
function tools() {
  const server = new McpServer({ name: "t", version: "0" });
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>>();
  const orig = server.registerTool.bind(server);
  (server as unknown as { registerTool: unknown }).registerTool = (name: string, cfg: unknown, cb: never) => {
    handlers.set(name, cb);
    return orig(name, cfg as never, cb);
  };
  registerCoachTools(server, { DB: fakeD1() } as unknown as Env);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await handlers.get(name)!(args);
    return { error: r.isError ?? false, value: JSON.parse(r.content[0].text) };
  };
  return { handlers, call };
}

describe("Coach-Werkzeuge", () => {
  it("registriert alle Werkzeuge", () => {
    expect([...tools().handlers.keys()].sort()).toEqual(
      ["delete_coach_note", "get_coach_context", "get_coach_notes", "get_goals", "get_plan", "get_training_prefs", "save_coach_note", "save_plan", "set_goals", "set_training_prefs"].sort(),
    );
  });

  it("Ziele, Plan übernehmen, anpassen, Kontext", async () => {
    const { call } = tools();
    const g = await call("set_goals", { goals: [{ kind: "event", title: "Radmarathon", targetDate: "2099-06-01", priority: "A" }] });
    expect(g.value.goals).toHaveLength(1);
    expect((await call("set_goals", { goals: [{ title: "ohne Art" }] })).error).toBe(true);

    const proposal = await call("get_plan");
    expect(proposal.value.stored).toBe(false);
    expect(proposal.value.plan.days).toHaveLength(7);
    expect(proposal.value.today).not.toBeNull();

    const saved = await call("save_plan", { accept: true });
    expect(saved.value.stored).toBe(true);

    const ws = saved.value.week as string;
    const custom = await call("save_plan", { days: [{ day: ws, type: "strength", durationMin: 60, strength: { durationMin: 60 } }] });
    expect(custom.value.plan.source).toBe("coach");
    expect(custom.value.plan.days[0].type).toBe("strength");
    expect(custom.value.plan.days[1].type).toBe("rest");

    expect((await call("save_plan", {})).error).toBe(true);
    expect((await call("save_plan", { reset: true })).value.deleted).toBe(true);

    const note = await call("save_coach_note", { kind: "daily", body: "Heute locker." });
    expect(note.value.id).toBeGreaterThan(0);

    const ctx = await call("get_coach_context");
    expect(ctx.value.goals[0].goal.title).toBe("Radmarathon");
    expect(ctx.value.coachNotes[0].body).toBe("Heute locker.");
    expect(ctx.value.guidance.join(" ")).toContain("keine medizinischen Diagnosen");
  });
});
