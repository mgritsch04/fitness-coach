-- Einheit mit unzuverlässigen Wiederholungen (z. B. nachträglich eingetragen): nur Gewichte als Orientierung, nicht in Statistik.
ALTER TABLE strength_sessions ADD COLUMN reps_unreliable INTEGER NOT NULL DEFAULT 0;
