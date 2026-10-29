-- Einseitige Übungen (#399): je Satz die Seite ('L' links, 'R' rechts; NULL = beidseitig).
ALTER TABLE strength_sets ADD COLUMN side TEXT;
-- Übung als einseitig markiert (Übungsverwaltung).
ALTER TABLE exercise_overrides ADD COLUMN unilateral INTEGER NOT NULL DEFAULT 0;
