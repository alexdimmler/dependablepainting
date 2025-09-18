CREATE TABLE IF NOT EXISTS lead_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT    NOT NULL,           -- ISO timestamp
  day          TEXT    NOT NULL,           -- YYYY-MM-DD (denormalized)
  hour         TEXT    NOT NULL,           -- HH (00-23)
  type         TEXT    NOT NULL,           -- e.g. form_submit, click_call, scroll, page_view
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
  gclid        TEXT
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_lead_events_ts        ON lead_events(ts);
CREATE INDEX IF NOT EXISTS idx_lead_events_day_type  ON lead_events(day, type);
CREATE INDEX IF NOT EXISTS idx_lead_events_session   ON lead_events(session);
CREATE INDEX IF NOT EXISTS idx_lead_events_type      ON lead_events(type);