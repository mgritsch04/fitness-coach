-- Wahoo-Tokens des Besitzers (rotierende Refresh-Tokens, immer das neueste Paar).
CREATE TABLE IF NOT EXISTS wahoo_tokens (
  whoop_user_id TEXT PRIMARY KEY,
  wahoo_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Einmal-Links für die Wahoo-Verbindung (vom Connector erzeugt, 15 Minuten gültig, einmal einlösbar).
CREATE TABLE IF NOT EXISTS wahoo_link_states (
  state TEXT PRIMARY KEY,
  whoop_user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
