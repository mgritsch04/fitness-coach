-- Laufende Gym-Einheit als Entwurf (eine Zeile): überlebt, wenn der Browser des Handys den lokalen Speicher verliert.
CREATE TABLE IF NOT EXISTS gym_draft (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
