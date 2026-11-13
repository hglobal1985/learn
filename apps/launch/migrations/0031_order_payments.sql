-- 學員在報名明細頁回報的繳費方式（可送出多次，保留紀錄；審核人員核對用，不是金流）。
CREATE TABLE order_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash', 'linepay', 'transfer', 'friend')),
  last5 TEXT,
  friend_name TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_order_payments_order ON order_payments(order_id, created_at);
