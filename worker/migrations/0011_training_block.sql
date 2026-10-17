-- 4-Wochen-Block (#206): gespeicherter Trainingsblock (3 Aufbauwochen + 1 Entlastungswoche). Ein Eintrag je Startwoche.
CREATE TABLE IF NOT EXISTS training_blocks (
  start_week TEXT PRIMARY KEY,
  block TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
