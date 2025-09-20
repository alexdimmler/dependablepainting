CREATE TABLE chat_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  json TEXT NOT NULL,
  session TEXT,
  question TEXT,
  -- The answer column stores the AI-generated response to the user's question. Must be non-empty if a response is provided.
  answer TEXT,
  ai_provider TEXT,
  user_agent TEXT,
  page TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (answer IS NULL OR length(trim(answer)) > 0)
);

-- chat.sql — chat transcripts tied to session for follow‑up
CREATE TABLE IF NOT EXISTS chat_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  session TEXT,
  question TEXT,
  answer TEXT,
  ai_provider TEXT,
  user_agent TEXT,
  page TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_log(ts);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_log(session);