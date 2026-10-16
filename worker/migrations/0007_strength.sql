-- Krafttraining: Einheiten mit Übungen und Sätzen (manuell erfasst), Vorlagen für wiederkehrende Einheiten.
-- Eine Einheit kann mit einem Workout einer Quelle verknüpft sein (meist WHOOP „weightlifting“).
CREATE TABLE IF NOT EXISTS strength_sessions (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  start_time TEXT,
  duration_min REAL,
  -- Anstrengung der ganzen Einheit, 1–10 (Session-RPE nach Foster)
  rpe REAL,
  name TEXT,
  notes TEXT,
  linked_source TEXT,
  linked_source_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS strength_sessions_day ON strength_sessions (day);

CREATE TABLE IF NOT EXISTS strength_sets (
  session_id TEXT NOT NULL REFERENCES strength_sessions (id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  -- Schlüssel aus dem Übungskatalog (core/strength.ts) oder der eingegebene Name in Kleinbuchstaben
  exercise TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg REAL NOT NULL DEFAULT 0,
  rpe REAL,
  -- JSON-Array mit Muskelgruppen, nur bei Übungen außerhalb des Katalogs
  muscles TEXT,
  PRIMARY KEY (session_id, idx)
);
CREATE INDEX IF NOT EXISTS strength_sets_exercise ON strength_sets (exercise);

CREATE TABLE IF NOT EXISTS strength_templates (
  name TEXT PRIMARY KEY,
  -- JSON: [{exercise, sets, reps, weightKg?}]
  exercises TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
