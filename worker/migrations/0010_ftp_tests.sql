-- FTP-Tests (#64): ausgewertete Ramp- und 20-min-Tests aus FIT-Dateien. Werte sind Schätzungen.
CREATE TABLE IF NOT EXISTS ftp_tests (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  day TEXT NOT NULL,
  protocol TEXT NOT NULL,
  basis_w REAL NOT NULL,
  ftp_w REAL NOT NULL,
  weight_kg REAL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (source, source_id)
);
