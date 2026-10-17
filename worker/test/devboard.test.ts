import { describe, expect, it } from "vitest";
import { buildDone, buildRepoBoard, loadDevBoard, type GhIssue, type GhPull } from "../src/devboard-tools";
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
    const noPulls = async () => [];
    await loadDevBoard(env, ok, () => t, noPulls);
    t += 4 * 60_000;
    await loadDevBoard(env, ok, () => t, noPulls);
    expect(calls).toBe(2); // ein Abruf je Repo, der zweite Aufruf kommt aus dem Speicher
    t += 2 * 60_000;
    const r = await loadDevBoard(env, async () => { throw new Error("GitHub antwortet mit 403"); }, () => t, noPulls);
    expect(r.stale).toBe(true);
    expect(r.projects.fitness.usertests.rows).toHaveLength(1);
  });
});

describe("buildDone", () => {
  const pr = (number: number, title: string, merged_at: string | null, body = ""): GhPull => ({ number, title, merged_at, body });
  const at = "2026-10-17T18:00:00Z";

  it("listet in main gemergte Feature-PRs, neueste zuerst, mit Teststand der verknüpften Issues", () => {
    const d = buildDone([
      pr(10, "feat(coach): Wochenplan", "2026-10-17T10:00:00Z", "Closes #3"),
      pr(11, "fix: Schlafkurve", "2026-10-17T12:00:00Z", "Refs #4\nrefs #4"),
      pr(12, "docs: Status", "2026-10-17T13:00:00Z", "Refs #3"),
      pr(13, "feat: verworfen", null, "Closes #5"),
      pr(14, "Neue Ansicht", "2026-10-16T09:00:00Z"),
    ], [issue(4, "Schlafkurve", ["auto-user-test"]), issue(9, "PR", [], true)], at);
    expect(d.at).toBe(at);
    expect(d.rows).toEqual([
      { nr: 11, titel: "Schlafkurve", merged: "2026-10-17T12:00:00Z", issues: [4], test: "offen" },
      { nr: 10, titel: "Wochenplan", merged: "2026-10-17T10:00:00Z", issues: [3], test: "getestet" },
      { nr: 14, titel: "Neue Ansicht", merged: "2026-10-16T09:00:00Z", issues: [], test: null },
    ]);
  });
});

describe("loadDevBoard fertige Features", () => {
  it("ruft gemergte PRs höchstens alle 30 Minuten ab und hängt sie je Projekt an", async () => {
    const m = new Map<string, string>();
    const env = { OAUTH_KV: { get: async (k: string) => (m.has(k) ? JSON.parse(m.get(k)!) : null), put: async (k: string, v: string) => void m.set(k, v) } } as unknown as Env;
    let pulls = 0;
    let t = Date.parse("2026-10-17T12:00:00Z");
    const fetchPulls = async (repo: string) => (pulls++, [{ number: 1, title: `feat: ${repo}`, body: "Closes #2", merged_at: "2026-10-17T11:00:00Z" }]);
    const r = await loadDevBoard(env, async () => [], () => t, fetchPulls);
    expect(r.projects.wp.done?.rows[0]).toMatchObject({ nr: 1, issues: [2], test: "getestet" });
    t += 6 * 60_000;
    await loadDevBoard(env, async () => [], () => t, fetchPulls);
    expect(pulls).toBe(2);
    t += 25 * 60_000;
    const late = await loadDevBoard(env, async () => [], () => t, async () => { throw new Error("403"); });
    expect(late.projects.fitness.done?.rows).toHaveLength(1);
  });
});
