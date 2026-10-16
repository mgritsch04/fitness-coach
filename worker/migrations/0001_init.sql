-- Besitzer des Workers: der erste WHOOP-Account, der sich anmeldet. Danach kommt niemand sonst rein.
CREATE TABLE IF NOT EXISTS app_owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  whoop_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- WHOOP-Tokens (rotierende Refresh-Tokens, immer das neueste Paar).
CREATE TABLE IF NOT EXISTS whoop_tokens (
  whoop_user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
