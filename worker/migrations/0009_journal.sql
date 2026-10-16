-- Tagebuch: ein Check-in je Tag (Skalen 1–5, Tags als JSON-Liste) und Anstrengung (RPE 1–10) je Workout.
CREATE TABLE IF NOT EXISTS journal (
  day TEXT PRIMARY KEY,
  feeling INTEGER,
  energy INTEGER,
  soreness INTEGER,
  stress INTEGER,
  motivation INTEGER,
  notes TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workout_rpe (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  day TEXT NOT NULL,
  rpe REAL NOT NULL,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, source_id)
);

CREATE INDEX IF NOT EXISTS workout_rpe_day ON workout_rpe (day);
