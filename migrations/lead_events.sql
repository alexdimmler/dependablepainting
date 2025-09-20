CREATE TABLE lead_events (
  id           INTEGER PRIMARY KEY,
  json         TEXT    NOT NULL,
  day          TEXT    NOT NULL,
  hour         TEXT    NOT NULL,
  type         TEXT    NOT NULL,
  page         TEXT,
  service      TEXT,
  source       TEXT,
  device       TEXT,
  city         TEXT,
  country      TEXT,
  zip          TEXT,
  area         TEXT,
  session      TEXT,
  scroll_pct   INTEGER DEFAULT 0,
  duration_ms  INTEGER DEFAULT 0,
  referrer     TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  gclid        TEXT,
);
-- lead_events.sql — high‑intent events for marketing/attribution
CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  day TEXT,
  hour TEXT,
  type TEXT NOT NULL,
  page TEXT,
  service TEXT,
  source TEXT,
  device TEXT,
  city TEXT,
  country TEXT,
  zip TEXT,
  area TEXT,
  session TEXT,
  scroll_pct INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  gclid TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON lead_events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON lead_events(type);
CREATE INDEX IF NOT EXISTS idx_events_service ON lead_events(service);
CREATE INDEX IF NOT EXISTS idx_events_page ON lead_events(page);
CREATE INDEX IF NOT EXISTS idx_events_session ON lead_events(session);
CREATE INDEX IF NOT EXISTS idx_events_gclid ON lead_events(gclid);
CREATE INDEX IF NOT EXISTS idx_events_utm_campaign ON lead_events(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_events_city ON lead_events(city);