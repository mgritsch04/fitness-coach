import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { validAccessToken, whoopGet, WhoopAuthError } from "./providers/whoop/client";
import { d1WhoopTokenStore } from "./store";
import type { AuthProps, Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

interface WhoopRecoveryPage {
  records: {
    cycle_id: number;
    created_at: string;
    score_state: string;
    score?: { recovery_score: number; resting_heart_rate: number; hrv_rmssd_milli: number; spo2_percentage?: number; skin_temp_celsius?: number };
  }[];
}

// Werkzeuge des Connectors. Jeder Aufruf kommt nur nach erfolgreicher Anmeldung hier an (OAuthProvider).
export function createServer(env: Env, props: AuthProps) {
  const server = new McpServer({ name: "fitness-coach", version: "0.1.0" });
  const creds = { clientId: env.WHOOP_CLIENT_ID, clientSecret: env.WHOOP_CLIENT_SECRET };
  const store = d1WhoopTokenStore(env.DB);

  server.registerTool(
    "ping",
    {
      description: "Verbindungstest: antwortet mit der Serverzeit und dem übergebenen Text.",
      inputSchema: { text: z.string().max(200).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ text }) => json({ ok: true, serverTime: new Date().toISOString(), echo: text ?? null }),
  );

  server.registerTool(
    "whoop_status",
    { description: "Ob WHOOP verbunden ist und bis wann das aktuelle Token gilt.", annotations: { readOnlyHint: true } },
    async () => {
      const tokens = await store.get(props.whoopUserId);
      return json({ connected: Boolean(tokens), tokenExpiresAt: tokens ? new Date(tokens.expiresAt).toISOString() : null });
    },
  );

  server.registerTool(
    "whoop_recovery",
    {
      description: "Letzte WHOOP-Recovery-Werte (Recovery %, Ruhepuls, HRV), neueste zuerst. Direkt von WHOOP gelesen, noch ohne Speicherung.",
      inputSchema: { limit: z.number().int().min(1).max(25).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const token = await validAccessToken(creds, store, props.whoopUserId);
        const page = await whoopGet<WhoopRecoveryPage>(token, `/v2/recovery?limit=${limit ?? 7}`);
        return json(
          page.records.map((r) => ({
            date: r.created_at,
            state: r.score_state,
            recovery: r.score?.recovery_score ?? null,
            restingHeartRate: r.score?.resting_heart_rate ?? null,
            hrvMs: r.score?.hrv_rmssd_milli ?? null,
          })),
        );
      } catch (err) {
        if (err instanceof WhoopAuthError) return { ...json({ error: "whoop_not_connected", message: err.message }), isError: true };
        throw err;
      }
    },
  );

  return server;
}
