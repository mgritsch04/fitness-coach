import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// Kleiner D1-Ersatz auf node:sqlite, damit die echten SQL-Anweisungen gegen das echte Schema laufen.
export function fakeD1(): D1Database {
  const sql = new DatabaseSync(":memory:");
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url).href);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) sql.exec(String(readFileSync(dir + f, "utf8")));
  const prepare = (query: string) => {
    let args: unknown[] = [];
    const stmt = {
      bind: (...a: unknown[]) => ((args = a), stmt),
      run: async () => (sql.prepare(query).run(...(args as never[])), { success: true }),
      first: async () => sql.prepare(query).get(...(args as never[])) ?? null,
      all: async () => ({ results: sql.prepare(query).all(...(args as never[])) }),
    };
    return stmt;
  };
  return { prepare, batch: async (s: { run: () => Promise<unknown> }[]) => Promise.all(s.map((x) => x.run())) } as unknown as D1Database;
}

