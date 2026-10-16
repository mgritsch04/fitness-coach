import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { validAccessToken, whoopGet, WhoopAuthError } from "./providers/whoop/client";
import { listWorkouts, toWorkout, validAccessToken as validWahooToken, WahooAuthError } from "./providers/wahoo/client";
import { d1WahooTokenStore, d1WhoopTokenStore } from "./store";
import { wahooConnectLink, wahooCredentials } from "./wahoo";
import { getSyncState, readDaily, readLatestBody, readSleeps, readWorkouts } from "./core/repository";
import { syncWhoop } from "./providers/whoop/sync";
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
export function createServer(env: Env, props: AuthProps, origin: string) {
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
      const sync = await getSyncState(env.DB, "whoop");
      return json({
        connected: Boolean(tokens),
        tokenExpiresAt: tokens ? new Date(tokens.expiresAt).toISOString() : null,
        lastSync: sync?.last_success_at ?? null,
        lastSyncError: sync?.last_error ?? null,
      });
    },
  );

  const days = { days: z.number().int().min(1).max(365).optional().describe("Zeitraum in Tagen bis heute, Standard 30") };
  const fromDay = (d?: number) => new Date(Date.now() - (d ?? 30) * 86_400_000).toISOString().slice(0, 10);

  server.registerTool(
    "get_daily",
    {
      description:
        "Gespeicherte Tageswerte, neueste zuerst: Erholung (recovery_score %, resting_hr, hrv_ms, spo2_pct, skin_temp_c) und Tagesbelastung (strain, energy_kj, avg_hr, max_hr).",
      inputSchema: days,
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await readDaily(env.DB, fromDay(d))),
  );

  server.registerTool(
    "get_sleep",
    {
      description: "Gespeicherte Schlafphasen, neueste zuerst. Dauern in Sekunden, day = Tag des Aufwachens, is_nap = Nickerchen.",
      inputSchema: days,
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await readSleeps(env.DB, fromDay(d))),
  );

  server.registerTool(
    "get_workouts",
    {
      description: "Gespeicherte Workouts aus allen Quellen, neueste zuerst (Dauer s, Distanz m, Energie kJ, Puls, Leistung W, Strain).",
      inputSchema: days,
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await readWorkouts(env.DB, fromDay(d))),
  );

  server.registerTool(
    "get_body",
    { description: "Zuletzt gespeicherte Körperwerte (Größe m, Gewicht kg, maximaler Puls).", annotations: { readOnlyHint: true } },
    async () => json(await readLatestBody(env.DB)),
  );

  server.registerTool(
    "sync_now",
    {
      description: "WHOOP jetzt abgleichen (sonst stündlich automatisch). full=true lädt die letzten 30 Tage neu.",
      inputSchema: { full: z.boolean().optional() },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ full }) => {
      try {
        return json(await syncWhoop(env.DB, creds, store, props.whoopUserId, { full }));
      } catch (err) {
        if (err instanceof WhoopAuthError) return { ...json({ error: "whoop_not_connected", message: err.message }), isError: true };
        throw err;
      }
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

  const wahooStore = d1WahooTokenStore(env.DB);
  const wahooNotConfigured = () => ({
    ...json({ error: "wahoo_not_configured", message: "Die Wahoo-App ist im Worker noch nicht eingerichtet (WAHOO_CLIENT_ID/SECRET fehlen)." }),
    isError: true,
  });

  server.registerTool(
    "wahoo_connect",
    {
      description:
        "Erzeugt einen Einmal-Link (15 Minuten gültig), über den sich der Nutzer bei Wahoo anmeldet und Wahoo mit dem Fitness Coach verbindet. Den Link dem Nutzer zum Öffnen geben.",
      annotations: { readOnlyHint: false },
    },
    async () => {
      const url = await wahooConnectLink(env, origin, props.whoopUserId);
      return url ? json({ url, expiresInMinutes: 15 }) : wahooNotConfigured();
    },
  );

  server.registerTool(
    "wahoo_status",
    { description: "Ob Wahoo verbunden ist und bis wann das aktuelle Token gilt.", annotations: { readOnlyHint: true } },
    async () => {
      const tokens = await wahooStore.get(props.whoopUserId);
      return json({
        configured: Boolean(wahooCredentials(env)),
        connected: Boolean(tokens),
        tokenExpiresAt: tokens ? new Date(tokens.expiresAt).toISOString() : null,
      });
    },
  );

  server.registerTool(
    "wahoo_workouts",
    {
      description:
        "Letzte Wahoo-Workouts mit Zusammenfassung (Dauer, Distanz, Puls, Leistung, TSS), neueste zuerst. Direkt von Wahoo gelesen, noch ohne Speicherung. Einheiten: Sekunden, Meter, Watt, m/s.",
      inputSchema: { limit: z.number().int().min(1).max(30).optional(), page: z.number().int().min(1).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ limit, page }) => {
      const wahooCreds = wahooCredentials(env);
      if (!wahooCreds) return wahooNotConfigured();
      try {
        const token = await validWahooToken(wahooCreds, wahooStore, props.whoopUserId);
        const result = await listWorkouts(token, page ?? 1, limit ?? 10);
        return json({ total: result.total ?? null, page: result.page ?? page ?? 1, workouts: result.workouts.map(toWorkout) });
      } catch (err) {
        if (err instanceof WahooAuthError) return { ...json({ error: "wahoo_not_connected", message: err.message }), isError: true };
        throw err;
      }
    },
  );

  return server;
}
