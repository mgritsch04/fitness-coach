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
