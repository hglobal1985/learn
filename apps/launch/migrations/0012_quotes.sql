-- 首頁「繼續學習」下方的學習金句（每次進入隨機顯示一則）。只有超級管理員可以管理。
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
