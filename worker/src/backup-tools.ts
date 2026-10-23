// Connector-Werkzeug für die Datensicherung (#378): alle eigenen Daten als eine JSON-Datei.
import type { McpServer } from "@modelcontextprotocol/server";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

// Eigene Daten. Bewusst nicht dabei: Zugangs-Tokens, Besitzer-Kennung, Verknüpfungs-Zustände (Geheimnisse)
// und die Roh-Messreihen der FIT-Importe (workout_streams, sehr groß, aus den Originaldateien neu erzeugbar).
export const BACKUP_TABLES = [
  ["daily", "day"],
  ["sleeps", "start_time"],
  ["workouts", "start_time"],
  ["body_measurements", "measured_at"],
  ["settings", "key"],
  ["strength_sessions", "rowid"],
  ["strength_sets", "rowid"],
  ["strength_templates", "rowid"],
  ["goals", "rowid"],
  ["training_plans", "rowid"],
  ["coach_notes", "rowid"],
  ["journal", "rowid"],
  ["workout_rpe", "rowid"],
  ["ftp_tests", "rowid"],
  ["training_blocks", "rowid"],
  ["recommendation_feedback", "rowid"],
  ["sweat_tests", "rowid"],
] as const;

export async function buildBackup(db: D1Database, now = new Date()) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const [table, order] of BACKUP_TABLES) {
    const { results } = await db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all<Record<string, unknown>>();
    tables[table] = results;
  }
  return {
    fileName: `fitness-sicherung-${now.toISOString().slice(0, 10)}.json`,
    mimeType: "application/json",
    createdAt: now.toISOString(),
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    tables,
  };
}

export function registerBackupTools(server: McpServer, env: Env) {
  server.registerTool(
    "export_backup",
    {
      description:
        "Sichert alle eigenen Daten (Tageswerte, Schlaf, Workouts, Körperwerte, Einstellungen, Kraft, Ziele, Pläne, Notizen, Tagebuch, FTP-Tests …) als eine JSON-Datei zum Herunterladen. " +
        "Ohne Zugangs-Tokens und ohne die Roh-Messreihen importierter FIT-Dateien.",
      annotations: { readOnlyHint: true },
    },
    async () => json(await buildBackup(env.DB)),
  );
}
