CREATE TABLE IF NOT EXISTS estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  name TEXT,
  email TEXT,
  phone TEXT,
  service TEXT,
  details TEXT,
  page TEXT,
  session TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  gclid TEXT
);

CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at);
CREATE INDEX IF NOT EXISTS idx_estimates_service ON estimates(service);
CREATE INDEX IF NOT EXISTS idx_estimates_session ON estimates(session);
CREATE INDEX IF NOT EXISTS idx_estimates_gclid ON estimates(gclid);