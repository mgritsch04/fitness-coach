import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  WHOOP_CLIENT_ID: string;
  WHOOP_CLIENT_SECRET: string;
  /** Fehlen, bis die Wahoo-App angelegt und die Secrets im Cloudflare-Dashboard gesetzt sind. */
  WAHOO_CLIENT_ID?: string;
  WAHOO_CLIENT_SECRET?: string;
}

/** Was nach der Anmeldung verschlüsselt am Connector-Token hängt. */
export interface AuthProps extends Record<string, unknown> {
  whoopUserId: string;
}
