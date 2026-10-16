-- MyWhoosh-FIT-Import: Trittfrequenz und TSS der Quelle je Workout, dazu Sekundenreihen und
-- Bestleistungskurve (für Leistungskurve und spätere Analysen).
ALTER TABLE workouts ADD COLUMN avg_cadence_rpm REAL;
ALTER TABLE workouts ADD COLUMN tss REAL;

CREATE TABLE IF NOT EXISTS workout_streams (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  interval_s INTEGER NOT NULL DEFAULT 1,
  -- JSON-Arrays, ein Wert pro Sekunde ab start_time, null = kein Wert
  power TEXT,
  heart_rate TEXT,
  cadence TEXT,
  -- JSON-Objekt {"Sekunden": Watt}
  power_curve TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, source_id)
);
