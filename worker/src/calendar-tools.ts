// Connector-Werkzeug für das Kalender-Abo (#373): Link erzeugen, ersetzen oder sperren.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createFeed, feedStatus, revokeFeed } from "./core/calendar";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function registerCalendarTools(server: McpServer, env: Env, origin: string) {
  server.registerTool(
    "manage_calendar_feed",
    {
      description:
        "Kalender-Abo für den Wochenplan (aktuelle und nächste Woche, mit Erinnerung). action=status zeigt, ob ein Link aktiv ist; create erzeugt einen neuen geheimen Link " +
        "(ein bisheriger wird ungültig; der Link wird nur dieses eine Mal angezeigt); revoke sperrt den Link. Der Link ist ein Geheimnis: nicht weitergeben.",
      inputSchema: { action: z.enum(["status", "create", "revoke"]) },
      annotations: { readOnlyHint: false },
    },
    async ({ action }) => {
      if (action === "create") {
        const token = await createFeed(env.DB);
        const host = origin.replace(/^https?:\/\//, "");
        return json({
          active: true,
          url: `${origin}/calendar/${token}.ics`,
          subscribeUrl: `webcal://${host}/calendar/${token}.ics`,
          note: "Link nur einmal sichtbar. Am iPhone: Link öffnen bzw. Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen. Wer den Link kennt, sieht den Wochenplan.",
        });
      }
      if (action === "revoke") {
        await revokeFeed(env.DB);
        return json({ active: false });
      }
      return json(await feedStatus(env.DB));
    },
  );
}
