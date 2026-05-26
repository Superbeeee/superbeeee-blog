CREATE TABLE IF NOT EXISTS hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  ai_source TEXT NOT NULL,
  kind TEXT NOT NULL,
  via TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT,
  ua TEXT,
  referer TEXT
);

CREATE INDEX IF NOT EXISTS idx_hits_ts ON hits(ts);
CREATE INDEX IF NOT EXISTS idx_hits_source ON hits(ai_source);
CREATE INDEX IF NOT EXISTS idx_hits_path ON hits(path);
