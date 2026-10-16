import { WahooAuthError } from "./providers/wahoo/client";
import { syncWahoo } from "./providers/wahoo/sync";
import { WhoopAuthError } from "./providers/whoop/client";
import { syncWhoop } from "./providers/whoop/sync";
import { d1WahooTokenStore, d1WhoopTokenStore } from "./store";
import { wahooCredentials } from "./wahoo";
import type { Env } from "./env";

type Outcome<T> = { ok: true; result: T } | { ok: false; error: string; message: string };

async function attempt<T>(run: () => Promise<T>, isAuthError: (e: unknown) => boolean, authCode: string): Promise<Outcome<T>> {
  try {
    return { ok: true, result: await run() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: isAuthError(err) ? authCode : "sync_failed", message };
  }
}

/**
 * Gleicht alle verbundenen Quellen des Besitzers ab. Eine Quelle, die scheitert, hält die andere nicht auf.
 * Wahoo wird übersprungen, solange die App nicht eingerichtet oder nicht verbunden ist.
 */
export async function syncAll(env: Env, ownerId: string, opts: { full?: boolean; days?: number } = {}) {
  const whoopCreds = { clientId: env.WHOOP_CLIENT_ID, clientSecret: env.WHOOP_CLIENT_SECRET };
  const wahooCreds = wahooCredentials(env);
  const wahooStore = d1WahooTokenStore(env.DB);
  const wahooConnected = wahooCreds ? Boolean(await wahooStore.get(ownerId)) : false;
  const [whoop, wahoo] = await Promise.all([
    attempt(() => syncWhoop(env.DB, whoopCreds, d1WhoopTokenStore(env.DB), ownerId, opts), (e) => e instanceof WhoopAuthError, "whoop_not_connected"),
    wahooCreds && wahooConnected
      ? attempt(() => syncWahoo(env.DB, wahooCreds, wahooStore, ownerId, opts), (e) => e instanceof WahooAuthError, "wahoo_not_connected")
      : Promise.resolve({ ok: false as const, error: wahooCreds ? "wahoo_not_connected" : "wahoo_not_configured", message: "übersprungen" }),
  ]);
  return { whoop, wahoo };
}
