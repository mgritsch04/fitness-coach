// Connector-Werkzeuge für Körperwerte und Export (#30): Gewichtsverlauf, eigene Einträge, CSV.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { addDays, DEFAULT_TIMEZONE, todayIn } from "./core/analysis";
import { analysisContext } from "./core/analytics";
import { bodyReport, deleteManualWeight, EXPORT_COLUMNS, readBodyHistory, readExport, saveManualWeight, toCsv, type ExportDataset } from "./core/body";
import { readGoals } from "./core/goals";
import { readSettings } from "./core/settings";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (error: string, message: string) => ({ ...json({ error, message }), isError: true });

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT");

export function registerBodyTools(server: McpServer, env: Env) {
  const db = env.DB;
  const today = async () => todayIn((await readSettings(db)).timezone ?? DEFAULT_TIMEZONE);

  async function report(days: number) {
    const ctx = await analysisContext(db, { days: 30 });
    const [rows, goals] = await Promise.all([readBodyHistory(db, addDays(ctx.today, -(days + 120))), readGoals(db)]);
    const g = goals.find((x) => x.metric === "weightKg");
    return {
      today: ctx.today,
      range: { from: addDays(ctx.today, -(days - 1)), to: ctx.today, days },
      ...bodyReport(rows, addDays(ctx.today, -(days - 1)), ctx.today, { watts: ctx.settings.ftpW, origin: ctx.settings.origin.ftpW },
        g ? { title: g.title, targetValue: g.targetValue ?? null, targetDate: g.targetDate ?? null } : null),
    };
  }

  server.registerTool(
    "get_body_history",
    {
      description:
        "Gewichtsverlauf (WHOOP-Profil und eigene Einträge, ein Wert je Tag mit 7-Tage-Mittel), Veränderung über 7/30/90 Tage, Trend in kg pro Woche, " +
        "BMI, W/kg mit aktueller FTP und Fortschritt zu einem aktiven Gewichtsziel. Trend und W/kg sind Schätzungen.",
      inputSchema: { days: z.number().int().min(7).max(730).optional().describe("Zeitraum in Tagen, Standard 180") },
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => json(await report(days ?? 180)),
  );

  server.registerTool(
    "log_weight",
    {
      description: "Trägt das eigene Gewicht für einen Tag ein (ersetzt einen früheren eigenen Eintrag am selben Tag). Hat Vorrang vor dem WHOOP-Wert.",
      inputSchema: { weightKg: z.number().min(30).max(250), day: DAY.optional().describe("Standard heute") },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ weightKg, day }) => {
      const t = await today();
      const d = day ?? t;
      if (d > t) return fail("future_day", "Das Datum liegt in der Zukunft.");
      await saveManualWeight(db, d, Number(weightKg.toFixed(2)));
      return json({ saved: { day: d, weightKg: Number(weightKg.toFixed(2)) }, ...(await report(90)) });
    },
  );

  server.registerTool(
    "delete_weight",
    {
      description: "Löscht den eigenen Gewichtseintrag eines Tages. WHOOP-Werte bleiben unverändert.",
      inputSchema: { day: DAY },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ day }) => json({ deleted: await deleteManualWeight(db, day), day }),
  );

  server.registerTool(
    "export_csv",
    {
      description:
        "Exportiert eigene Rohdaten als CSV-Text zum Herunterladen: daily (Erholung, HRV, Ruhepuls, Strain …), sleeps, workouts oder body. " +
        "excel=true liefert Semikolon und Dezimalkomma für deutsches Excel.",
      inputSchema: {
        dataset: z.enum(Object.keys(EXPORT_COLUMNS) as [ExportDataset, ...ExportDataset[]]),
        days: z.number().int().min(1).max(3650).optional().describe("Zeitraum in Tagen, Standard 365"),
        excel: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ dataset, days, excel }) => {
      const t = await today();
      const from = addDays(t, -((days ?? 365) - 1));
      const rows = await readExport(db, dataset, from);
      return json({
        fileName: `fitness-${dataset}-${from}-bis-${t}.csv`,
        mimeType: "text/csv",
        rows: rows.length,
        columns: EXPORT_COLUMNS[dataset],
        csv: toCsv(rows, EXPORT_COLUMNS[dataset], excel ?? false),
      });
    },
  );
}
