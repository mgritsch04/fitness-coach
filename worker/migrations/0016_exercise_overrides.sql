-- Übungsverwaltung (#399): Umbenennen, Zusammenführen, Ausblenden und manuelle Muskelgruppen je Übung.
-- Die gespeicherten Sätze bleiben unverändert; die Zuordnung wird beim Lesen angewendet, daher gehen
-- Verlauf und Bestwerte beim Zusammenführen nicht verloren und lassen sich wieder trennen.
CREATE TABLE IF NOT EXISTS exercise_overrides (
  -- Übungsschlüssel (Katalog-Schlüssel oder normalisierter Name)
  key TEXT PRIMARY KEY,
  -- Schlüssel der Übung, in die diese aufgeht (NULL = eigenständig)
  merged_into TEXT,
  display_name TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  -- JSON-Arrays mit Muskelgruppen; NULL = automatisch
  muscles_primary TEXT,
  muscles_secondary TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
