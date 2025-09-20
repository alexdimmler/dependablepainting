CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  order_id TEXT UNIQUE,
  amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  items TEXT,
  service TEXT,
  source TEXT,
  gclid TEXT,
  session TEXT,
  email TEXT,
  phone TEXT,
  name TEXT,
  city TEXT,
  page TEXT,
  status TEXT,
  schedule_json TEXT
);

CREATE INDEX IF NOT EXISTS id_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS id_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS id_orders_session ON orders(session);
CREATE INDEX IF NOT EXISTS id_orders_gclid ON orders(gclid);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT,
  sku TEXT,
  qty INTEGER,
  unit TEXT,
  unit_price_cents INTEGER,
  total_cents INTEGER,
  meta_json TEXT,
  PRIMARY KEY(order_id, sku)
);