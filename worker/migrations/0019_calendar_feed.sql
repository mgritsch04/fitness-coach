-- Kalender-Abo (#373): nur der SHA-256-Hash des geheimen Links wird gespeichert (nie der Link selbst).
-- Eigene Tabelle statt `settings`, damit der Hash nicht in der Datensicherung landet.
CREATE TABLE IF NOT EXISTS calendar_feed (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
