-- Schweißrate (#282): Gewicht vor/nach einer Radeinheit plus getrunkene Menge.
CREATE TABLE IF NOT EXISTS sweat_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  weight_before_kg REAL NOT NULL,
  weight_after_kg REAL NOT NULL,
  drank_l REAL NOT NULL,
  indoor INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sweat_tests_day ON sweat_tests (day);
