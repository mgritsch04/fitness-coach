import type { WahooTokenStore, WahooTokens } from "./providers/wahoo/client";
import type { WhoopTokenStore, WhoopTokens } from "./providers/whoop/client";

/**
 * Legt beim ersten Login den Besitzer fest und prüft danach, ob es derselbe Account ist.
 * Liefert true, wenn `whoopUserId` der Besitzer ist.
 */
export async function claimOrCheckOwner(db: D1Database, whoopUserId: string): Promise<boolean> {
  await db.prepare("INSERT OR IGNORE INTO app_owner (id, whoop_user_id) VALUES (1, ?)").bind(whoopUserId).run();
  const row = await db.prepare("SELECT whoop_user_id FROM app_owner WHERE id = 1").first<{ whoop_user_id: string }>();
  return row?.whoop_user_id === whoopUserId;
}

export function d1WhoopTokenStore(db: D1Database): WhoopTokenStore {
  return {
    async get(userId) {
      const row = await db
        .prepare("SELECT access_token, refresh_token, expires_at FROM whoop_tokens WHERE whoop_user_id = ?")
        .bind(userId)
        .first<{ access_token: string; refresh_token: string; expires_at: number }>();
      return row ? { accessToken: row.access_token, refreshToken: row.refresh_token, expiresAt: row.expires_at } : null;
    },
    async put(userId, t: WhoopTokens) {
      await db
        .prepare(
          `INSERT INTO whoop_tokens (whoop_user_id, access_token, refresh_token, expires_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT (whoop_user_id) DO UPDATE SET access_token = excluded.access_token,
             refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
        )
        .bind(userId, t.accessToken, t.refreshToken, t.expiresAt)
        .run();
    },
  };
}

/** Wahoo-Tokens hängen am Besitzer (WHOOP-ID); `put` beim ersten Verbinden braucht die Wahoo-ID. */
export function d1WahooTokenStore(db: D1Database): WahooTokenStore & {
  connect(ownerId: string, wahooUserId: string, t: WahooTokens): Promise<void>;
} {
  return {
    async get(ownerId) {
      const row = await db
        .prepare("SELECT access_token, refresh_token, expires_at FROM wahoo_tokens WHERE whoop_user_id = ?")
        .bind(ownerId)
        .first<{ access_token: string; refresh_token: string; expires_at: number }>();
      return row ? { accessToken: row.access_token, refreshToken: row.refresh_token, expiresAt: row.expires_at } : null;
    },
    async put(ownerId, t) {
      await db
        .prepare("UPDATE wahoo_tokens SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now') WHERE whoop_user_id = ?")
        .bind(t.accessToken, t.refreshToken, t.expiresAt, ownerId)
        .run();
    },
    async connect(ownerId, wahooUserId, t) {
      await db
        .prepare(
          `INSERT INTO wahoo_tokens (whoop_user_id, wahoo_user_id, access_token, refresh_token, expires_at, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT (whoop_user_id) DO UPDATE SET wahoo_user_id = excluded.wahoo_user_id, access_token = excluded.access_token,
             refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
        )
        .bind(ownerId, wahooUserId, t.accessToken, t.refreshToken, t.expiresAt)
        .run();
    },
  };
}

/** Legt einen Einmal-Link-Code für die Wahoo-Verbindung an (15 Minuten gültig). */
export async function createWahooLinkState(db: D1Database, ownerId: string, now = Date.now()): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await db.batch([
    db.prepare("DELETE FROM wahoo_link_states WHERE expires_at < ?").bind(now),
    db.prepare("INSERT INTO wahoo_link_states (state, whoop_user_id, expires_at) VALUES (?, ?, ?)").bind(state, ownerId, now + 15 * 60_000),
  ]);
  return state;
}

/** Löst einen Link-Code ein (nur einmal möglich). Liefert die Besitzer-ID oder null. */
export async function consumeWahooLinkState(db: D1Database, state: string, now = Date.now()): Promise<string | null> {
  const row = await db
    .prepare("DELETE FROM wahoo_link_states WHERE state = ? RETURNING whoop_user_id, expires_at")
    .bind(state)
    .first<{ whoop_user_id: string; expires_at: number }>();
  return row && row.expires_at >= now ? row.whoop_user_id : null;
}
