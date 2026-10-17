import { describe, expect, it } from "vitest";
import { buildRepoBoard, loadDevBoard, type GhIssue } from "../src/devboard-tools";
import type { Env } from "../src/env";

const issue = (number: number, title: string, labels: string[], pr = false): GhIssue => ({ number, title, labels: labels.map((name) => ({ name })), ...(pr ? { pull_request: {} } : {}) });

describe("buildRepoBoard", () => {
  const at = "2026-10-17T12:00:00Z";
  const b = buildRepoBoard([
    issue(1, "[USERTEST] Alter Test", ["user-test"]),
    issue(2, "Feature mit Auto-Test", ["auto-user-test", "planned"]),
    issue(3, "Muss nachgebessert werden", ["needs-fix", "auto-user-test"]),
    issue(4, "Wird gebaut", ["in-progress"]),
    issue(5, "[AUFGABE] Token setzen", ["user-task"]),
    issue(6, "Idee", ["idea-inbox"]),
    issue(7, "feat(coach): neuer Plan", [], true),
  ], at);

  it("teilt Tests nach Label auf, mit Vorrang user-test > needs-fix > auto-user-test", () => {
    expect(b.usertests.rows).toEqual([
      { nr: 3, titel: "Muss nachgebessert werden", bereit: "nein" },
      { nr: 2, titel: "Feature mit Auto-Test", bereit: "auto" },
      { nr: 1, titel: "Alter Test", bereit: "ja" },
    ]);
    expect(b.usertests.at).toBe(at);
  });

  it("listet laufende Issues, offene PRs und Aufgaben für G als Features", () => {
    expect(b.features.rows).toEqual([
      { nr: 7, titel: "neuer Plan", wer: "PR", stand: "PR offen" },
      { nr: 5, titel: "Token setzen", wer: "wartet auf dich", stand: "blockiert" },
      { nr: 4, titel: "Wird gebaut", wer: "Thread", stand: "in Arbeit" },
    ]);
  });

  it("schätzt den Backlog aus planned und idea-inbox", () => {
    expect(b.forecast.inProgress.map((r) => r.nr)).toEqual([4]);
    expect(b.forecast.items.map((r) => [r.nr, r.hinweis])).toEqual([[6, "idea-inbox"], [2, "planned"]]);
  });
});

describe("loadDevBoard", () => {
  const kv = () => {
    const m = new Map<string, string>();
    return { get: async (k: string) => (m.has(k) ? JSON.parse(m.get(k)!) : null), put: async (k: string, v: string) => void m.set(k, v) };
  };

  it("nutzt den Zwischenspeicher 5 Minuten und zeigt bei GitHub-Fehlern den letzten Stand", async () => {
    const env = { OAUTH_KV: kv() } as unknown as Env;
    let calls = 0;
    let t = Date.parse("2026-10-17T12:00:00Z");
    const ok = async () => (calls++, [issue(1, "x", ["user-test"])]);
    await loadDevBoard(env, ok, () => t);
    t += 4 * 60_000;
    await loadDevBoard(env, ok, () => t);
    expect(calls).toBe(2); // ein Abruf je Repo, der zweite Aufruf kommt aus dem Speicher
    t += 2 * 60_000;
    const r = await loadDevBoard(env, async () => { throw new Error("GitHub antwortet mit 403"); }, () => t);
    expect(r.stale).toBe(true);
    expect(r.projects.fitness.usertests.rows).toHaveLength(1);
  });
});
