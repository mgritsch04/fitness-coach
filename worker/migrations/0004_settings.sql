-- Persönliche Einstellungen für die Auswertung (FTP, Pulswerte, Schlafbedarf, Zeitzone).
-- Ein Schlüssel je Wert, Werte als JSON.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
