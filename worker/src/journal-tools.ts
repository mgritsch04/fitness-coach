// Connector-Werkzeuge für das Tagebuch (Check-in je Tag, RPE je Workout).
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { addDays, todayIn } from "./core/analysis";
import { SUGGESTED_TAGS, deleteJournal, readJournal, readRpe, saveJournal, saveRpe } from "./core/journal";
import { readSettings } from "./core/settings";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (error: string, message: string) => ({ ...json({ error, message }), isError: true });
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT");
const scale = (what: string) => z.number().int().min(1).max(5).nullable().optional().describe(what);

export function registerJournalTools(server: McpServer, env: Env) {
  const db = env.DB;
  const today = async () => todayIn((await readSettings(db)).timezone ?? "Europe/Berlin");

  server.registerTool(
    "get_journal",
    {
      description: "Tagebuch der letzten Tage (neueste zuerst): Befinden, Energie, Muskelkater, Stress, Motivation (1–5), Notiz, Tags; dazu RPE je Workout und Vorschläge für Tags.",
      inputSchema: { days: z.number().int().min(1).max(365).optional().describe("Zeitraum bis heute, Standard 14") },
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      const t = await today();
      const from = addDays(t, -((days ?? 14) - 1));
      const [entries, rpe] = await Promise.all([readJournal(db, from, t), readRpe(db, from)]);
      return json({ today: t, entries, rpe, suggestedTags: SUGGESTED_TAGS });
    },
  );

  server.registerTool(
    "save_journal",
    {
      description:
        "Speichert den Check-in eines Tages (Standard heute). Nur übergebene Felder ändern sich, null löscht ein Feld; tags ersetzt die Liste. " +
        "Skalen 1–5: feeling/energy/motivation 1 = schlecht … 5 = sehr gut, soreness/stress 1 = keiner … 5 = stark. Tag „krank“ setzt die Empfehlung auf Ruhe. remove=true löscht den Tag.",
      inputSchema: {
        day: DAY.optional(),
        feeling: scale("Befinden"),
        energy: scale("Energie"),
        soreness: scale("Muskelkater"),
        stress: scale("Stress"),
        motivation: scale("Motivation"),
        notes: z.string().max(2000).nullable().optional(),
        tags: z.array(z.string().max(30)).max(15).nullable().optional(),
        remove: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ day, remove, tags, ...rest }) => {
      const d = day ?? (await today());
      if (remove) return json({ day: d, deleted: await deleteJournal(db, d) });
      return json(await saveJournal(db, { day: d, ...rest, ...(tags === undefined ? {} : { tags: tags ?? [] }) }));
    },
  );

  server.registerTool(
    "save_workout_rpe",
    {
      description:
        "Anstrengung (RPE 1–10, Borg CR10: 1 sehr leicht … 10 maximal) zu einem Workout speichern; source und sourceId stehen in get_dashboard → workouts. rpe=null löscht. " +
        "Session-RPE = Dauer × RPE erscheint im Dashboard (vor allem für Krafttraining, wo der Puls die Belastung unterschätzt).",
      inputSchema: { source: z.string().max(20), sourceId: z.string().max(80), rpe: z.number().min(1).max(10).nullable(), notes: z.string().max(500).nullable().optional() },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async (r) => {
      try {
        return json({ saved: await saveRpe(db, r) });
      } catch (err) {
        return fail("workout_not_found", (err as Error).message);
      }
    },
  );
}
