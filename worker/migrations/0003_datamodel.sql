-- Gemeinsames Datenmodell (anbieterunabhängig). Jede Zeile kennt ihre Quelle und die Roh-ID dort,
-- damit ein erneuter Abgleich dieselbe Zeile aktualisiert statt sie zu verdoppeln.
-- Zeiten als ISO-8601 in UTC, `day` als lokales Datum (YYYY-MM-DD) des Nutzers.

-- Tageswerte: Erholung und Tagesbelastung (bei WHOOP ein „Cycle“ mit Recovery).
CREATE TABLE IF NOT EXISTS daily (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  strain REAL,
  energy_kj REAL,
  avg_hr INTEGER,
  max_hr INTEGER,
  recovery_score REAL,
  resting_hr REAL,
  hrv_ms REAL,
  spo2_pct REAL,
  skin_temp_c REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, source_id)
);
CREATE INDEX IF NOT EXISTS daily_day ON daily (day);

CREATE TABLE IF NOT EXISTS sleeps (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_nap INTEGER NOT NULL DEFAULT 0,
  in_bed_s INTEGER,
  asleep_s INTEGER,
  awake_s INTEGER,
  light_s INTEGER,
  deep_s INTEGER,
  rem_s INTEGER,
  performance_pct REAL,
  efficiency_pct REAL,
  consistency_pct REAL,
  respiratory_rate REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, source_id)
);
CREATE INDEX IF NOT EXISTS sleeps_day ON sleeps (day);

-- Workouts aus allen Quellen (WHOOP, Wahoo, MyWhoosh-FIT). Duplikate über Startzeit ± Toleranz
-- werden beim Auslesen zusammengeführt, nicht beim Speichern.
CREATE TABLE IF NOT EXISTS workouts (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  sport TEXT,
  duration_s INTEGER,
  distance_m REAL,
  energy_kj REAL,
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_power_w REAL,
  normalized_power_w REAL,
  strain REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, source_id)
);
CREATE INDEX IF NOT EXISTS workouts_start ON workouts (start_time);

CREATE TABLE IF NOT EXISTS body_measurements (
  source TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  height_m REAL,
  weight_kg REAL,
  max_hr INTEGER,
  PRIMARY KEY (source, measured_at)
);

CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_attempt_at TEXT,
  last_error TEXT
);
