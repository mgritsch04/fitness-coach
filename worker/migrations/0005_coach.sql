-- Trainingscoach: Ziele, gespeicherte Wochenpläne und Coach-Notizen (von Claude im Artefakt geschrieben).

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- event (Wettkampf/Termin), fitness (z. B. FTP, CTL), weight, habit (z. B. Stunden pro Woche), other
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  target_date TEXT,
  metric TEXT,
  target_value REAL,
  unit TEXT,
  sport TEXT,
  -- A = Hauptziel, B = wichtig, C = nebenbei
  priority TEXT NOT NULL DEFAULT 'B',
  -- active, done, dropped
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS goals_status_date ON goals (status, target_date);

-- Ein Plan je Woche (Montag), Inhalt als JSON (Tage mit Einheiten).
CREATE TABLE IF NOT EXISTS training_plans (
  week_start TEXT PRIMARY KEY,
  -- rule (Regelplan übernommen) oder coach (von Claude angepasst)
  source TEXT NOT NULL,
  plan TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Texte und Auswertungen, die Claude als Coach im Artefakt erstellt, damit sie bleiben und das
-- Dashboard sie zeigen kann.
CREATE TABLE IF NOT EXISTS coach_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- daily (Tageshinweis), weekly_review (Wochenrückblick), insight (Erkenntnis), chat (gemerkte Antwort)
  kind TEXT NOT NULL,
  day TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  -- optionale strukturierte Daten für die Visualisierung (JSON)
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS coach_notes_day ON coach_notes (day, kind);
