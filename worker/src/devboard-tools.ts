// Connector-Werkzeug für das Master-Dashboard (Entwicklungsstand beider Projekte, #309):
// Tests, Features und Backlog direkt aus den offenen GitHub-Issues, ohne Modell. Beide Repos sind öffentlich.
import type { McpServer } from "@modelcontextprotocol/server";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export const DEV_REPOS = { fitness: "mgritsch04/fitness-coach", wp: "mgritsch04/wohnungsplaner-3d" } as const;
const CACHE_KEY = "devboard:v1";
// Unauthentifiziert erlaubt GitHub 60 Anfragen pro Stunde; ein Abruf braucht 1 Seite je 100 offene Issues und Repo.
const FRESH_MS = 5 * 60_000;
const RATE = 2.5;

/** Was die Issues-API je Eintrag liefert (Pull Requests sind dort mit `pull_request` enthalten). */
export interface GhIssue {
  number: number;
  title: string;
  labels: ({ name?: string } | string)[];
  pull_request?: unknown;
}

const labelNames = (i: GhIssue) => i.labels.map((l) => (typeof l === "string" ? l : l.name ?? ""));
const cleanIssueTitle = (t: string) => t.replace(/^\[[A-ZÄÖÜ-]+\]\s*/, "");
const cleanPrTitle = (t: string) => t.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "");

/** Baut aus den offenen Issues und PRs eines Repos die Dashboard-Dokumente (gleiches Format wie board/*). */
export function buildRepoBoard(items: GhIssue[], at: string) {
  const usertests: { nr: number; titel: string; bereit: "ja" | "nein" | "auto" }[] = [];
  const features: { nr: number; titel: string; wer: string; stand: string }[] = [];
  const inProgress: { nr: number; titel: string; size: number; hinweis: string }[] = [];
  const backlog: { nr: number; titel: string; size: number; hinweis: string }[] = [];
  for (const i of [...items].sort((a, b) => b.number - a.number)) {
    if (i.pull_request) {
      features.push({ nr: i.number, titel: cleanPrTitle(i.title), wer: "PR", stand: "PR offen" });
      continue;
    }
    const l = labelNames(i);
    const titel = cleanIssueTitle(i.title);
    const bereit = l.includes("user-test") ? "ja" : l.includes("needs-fix") ? "nein" : l.includes("auto-user-test") ? "auto" : null;
    if (bereit) usertests.push({ nr: i.number, titel, bereit });
    if (l.includes("in-progress")) {
      features.push({ nr: i.number, titel, wer: "Thread", stand: "in Arbeit" });
      inProgress.push({ nr: i.number, titel, size: 1, hinweis: "in Arbeit" });
    } else if (l.includes("planned") || l.includes("idea-inbox")) {
      backlog.push({ nr: i.number, titel, size: 2, hinweis: l.includes("planned") ? "planned" : "idea-inbox" });
    }
    if (l.includes("user-task")) features.push({ nr: i.number, titel, wer: "wartet auf dich", stand: "blockiert" });
  }
  return {
    usertests: { at, rows: usertests },
    features: { at, rows: features },
    forecast: { at, rate: RATE, rateBasis: "Schätzung: 2,5 Punkte pro Arbeitsstunde", inProgress, items: backlog },
  };
}

async function fetchOpenIssues(repo: string, token?: string): Promise<GhIssue[]> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "fitness-coach (privat)" };
  if (token) headers.authorization = `Bearer ${token}`;
  const all: GhIssue[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=100&page=${page}`, { headers });
    if (!r.ok) throw new Error(`GitHub antwortet für ${repo} mit ${r.status}`);
    const batch = (await r.json()) as GhIssue[];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

type Board = { at: string; projects: Record<keyof typeof DEV_REPOS, ReturnType<typeof buildRepoBoard>> };

export async function loadDevBoard(env: Env, fetchIssues = fetchOpenIssues, now = () => Date.now()): Promise<Board & { stale?: boolean; error?: string }> {
  const hit = (await env.OAUTH_KV?.get(CACHE_KEY, "json").catch(() => null)) as Board | null;
  if (hit && now() - Date.parse(hit.at) < FRESH_MS) return hit;
  try {
    const at = new Date(now()).toISOString();
    const [fitness, wp] = await Promise.all([fetchIssues(DEV_REPOS.fitness, env.GITHUB_READ_TOKEN), fetchIssues(DEV_REPOS.wp, env.GITHUB_READ_TOKEN)]);
    const board: Board = { at, projects: { fitness: buildRepoBoard(fitness, at), wp: buildRepoBoard(wp, at) } };
    await env.OAUTH_KV?.put(CACHE_KEY, JSON.stringify(board), { expirationTtl: 86400 }).catch(() => undefined);
    return board;
  } catch (e) {
    // Limit erreicht oder GitHub weg: letzten Stand weiterzeigen, als veraltet markiert.
    if (hit) return { ...hit, stale: true, error: (e as Error).message };
    throw e;
  }
}

export function registerDevBoardTools(server: McpServer, env: Env) {
  server.registerTool(
    "get_dev_board",
    {
      description: "Entwicklungsstand der Projekte Fitness Coach und Wohnungsplaner aus GitHub: offene User-Tests (G prüft / automatisch / wird nachgebessert), Features in Arbeit samt offener PRs und Backlog. Für das Master-Dashboard, höchstens alle 5 Minuten neu von GitHub.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => json(await loadDevBoard(env)),
  );
}
