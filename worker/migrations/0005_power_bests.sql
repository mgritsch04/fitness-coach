-- Leistungskurve: beste Durchschnittsleistung je Dauer und Fahrt (aus Sekundenwerten, z. B. FIT-Dateien).
-- Wird je Fahrt einmal berechnet; die Kurve über einen Zeitraum ist das Maximum je Dauer.
CREATE TABLE IF NOT EXISTS power_bests (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  day TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  watts REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, source_id, duration_s)
);
CREATE INDEX IF NOT EXISTS power_bests_day ON power_bests (day);
