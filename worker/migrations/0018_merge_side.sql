-- Zusammenführen mit Seitenzuordnung: Sätze der aufgegangenen Übung ohne Seite gelten als links ('L') bzw. rechts ('R').
-- Die gespeicherten Sätze bleiben unverändert; die Seite wird beim Lesen ergänzt.
ALTER TABLE exercise_overrides ADD COLUMN merge_side TEXT;
