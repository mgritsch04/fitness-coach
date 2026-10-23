// Connector-Werkzeuge des FTP-Test-Assistenten (#64): Test auswerten, speichern/übernehmen, Verlauf und Vorschlag.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { analysisContext } from "./core/analytics";
import { readBodyHistory, weightByDay } from "./core/body";
import { analyzeFtpTest, deleteFtpTest, ftpHistory, ftpTestSuggestion, readFtpTests, saveFtpTest } from "./core/ftp-test";
import { readWorkoutStream } from "./core/repository";
import { readPrefs } from "./core/goals";
import { writeSettings } from "./core/settings";
import { listDetailWorkouts } from "./core/workout-detail";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (error: string, message: string) => ({ ...json({ error, message }), isError: true });

const PROTOCOL = z.enum(["auto", "ramp", "20min"]).optional().describe("auto (Standard) erkennt das Protokoll aus der Fahrt");

export function registerFtpTools(server: McpServer, env: Env) {
  const db = env.DB;

  /** Fahrt laden (Standard: neueste mit Sekundenwerten) und auswerten. */
  async function analyze(source?: string, sourceId?: string, protocol: "auto" | "ramp" | "20min" = "auto") {
    const target = source && sourceId ? { source, source_id: sourceId } : (await listDetailWorkouts(db, 1))[0];
    if (!target) return { error: "no_stream", message: "Noch keine Fahrt mit Sekundenwerten (FIT-Datei) vorhanden." } as const;
    const stream = await readWorkoutStream(db, target.source, target.source_id);
    if (!stream) return { error: "no_stream", message: "Für dieses Workout gibt es keine Sekundenwerte (nur Fahrten aus FIT-Dateien)." } as const;
    const w = await db.prepare("SELECT day, start_time, sport, duration_s FROM workouts WHERE source = ? AND source_id = ?").bind(target.source, target.source_id).first<{ day: string; start_time: string; sport: string | null; duration_s: number }>();
    return { workout: { source: target.source, sourceId: target.source_id, day: w?.day ?? String((stream as Record<string, unknown>).start_time).slice(0, 10), sport: w?.sport ?? null, durationS: w?.duration_s ?? null }, result: analyzeFtpTest(stream.power as (number | null)[] | null, protocol) };
  }

  async function weightOn(day: string) {
    const pts = weightByDay(await readBodyHistory(db, "0000-00-00")).filter((p) => p.day <= day);
    return pts.at(-1)?.weightKg ?? null;
  }

  async function overview() {
    const [ctx, rows] = await Promise.all([analysisContext(db, { days: 7 }), readFtpTests(db)]);
    const tests = ftpHistory(rows);
    const prefs = await readPrefs(db);
    const manual = ctx.settings.origin.ftpW === "user" && ctx.settings.ftpW != null && tests.length === 0;
    const tsb = ctx.series.find((p) => p.day === ctx.today)?.tsb ?? ctx.series.at(-1)?.tsb ?? null;
    return {
      today: ctx.today,
      current: { ftpW: ctx.settings.ftpW, origin: ctx.settings.origin.ftpW, estimate: ctx.ftpEstimate },
      tests,
      suggestion: manual || prefs.noFtpTest
        ? { suggest: false, reason: prefs.noFtpTest ? "Automatische FTP-Test-Vorschläge sind ausgeschaltet." : "Deine FTP ist von Hand eingetragen und zählt wie ein Test; ein neuer Test wird nicht vorgeschlagen.", daysSinceLastTest: null, tsb, howTo: [] }
        : ftpTestSuggestion(tsb, tests.at(-1)?.day ?? null, ctx.today),
      notes: ["FTP aus Tests ist eine Schätzung nach dem jeweiligen Protokoll (Ramp 75 % der besten Minute, 20 min 95 %). Trainingsempfehlung, keine Diagnose."],
    };
  }

  server.registerTool(
    "get_ftp_tests",
    {
      description: "FTP-Test-Verlauf (Datum, Protokoll, FTP, W/kg, Veränderung), aktuelle FTP mit Herkunft und ein Vorschlag, ob jetzt ein guter Zeitpunkt für einen Test ist.",
      annotations: { readOnlyHint: true },
    },
    async () => json(await overview()),
  );

  server.registerTool(
    "analyze_ftp_test",
    {
      description:
        "Wertet eine Fahrt mit Sekundenwerten als FTP-Test aus (Standard: die neueste). Erkennt Ramp- oder 20-min-Test automatisch oder nach Vorgabe. Speichert nichts.",
      inputSchema: {
        source: z.string().max(20).optional().describe("Quelle aus get_workout_detail, z. B. mywhoosh"),
        sourceId: z.string().max(100).optional(),
        protocol: PROTOCOL,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ source, sourceId, protocol }) => {
      const r = await analyze(source, sourceId, protocol);
      return "error" in r ? fail(r.error!, r.message!) : json(r);
    },
  );

  server.registerTool(
    "save_ftp_test",
    {
      description:
        "Speichert eine Fahrt als FTP-Test im Verlauf. apply=true übernimmt die FTP zusätzlich in die Einstellungen (Zonen und Belastung rechnen dann damit).",
      inputSchema: { source: z.string().max(20), sourceId: z.string().max(100), protocol: PROTOCOL, apply: z.boolean().optional() },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ source, sourceId, protocol, apply }) => {
      const r = await analyze(source, sourceId, protocol);
      if ("error" in r) return fail(r.error!, r.message!);
      if (!r.result.protocol || r.result.ftpW == null) return fail("not_a_test", r.result.message);
      await saveFtpTest(db, {
        day: r.workout.day, source, source_id: sourceId, protocol: r.result.protocol, basis_w: r.result.basisW!, ftp_w: r.result.ftpW,
        weight_kg: await weightOn(r.workout.day), applied: apply ? 1 : 0,
      });
      if (apply) await writeSettings(db, { ftpW: r.result.ftpW });
      return json({ saved: r.result, applied: !!apply, ...(await overview()) });
    },
  );

  server.registerTool(
    "delete_ftp_test",
    {
      description: "Entfernt einen Test aus dem FTP-Verlauf. Die FTP in den Einstellungen bleibt unverändert.",
      inputSchema: { source: z.string().max(20), sourceId: z.string().max(100) },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ source, sourceId }) => json({ deleted: await deleteFtpTest(db, source, sourceId) }),
  );
}
