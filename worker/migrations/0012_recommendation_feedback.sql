-- Rückmeldung zur Tagesempfehlung (#216): passt / zu hart / zu leicht, eine je Tag.
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  day TEXT PRIMARY KEY,
  verdict TEXT NOT NULL CHECK (verdict IN ('ok', 'too_hard', 'too_easy')),
  readiness TEXT,
  note TEXT,
  updated_at TEXT NOT NULL
);
