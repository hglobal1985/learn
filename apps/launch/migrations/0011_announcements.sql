-- 首頁跑馬燈公告：多則公告自動輪流顯示。只有超級管理員與總部秘書可以管理。
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_announcements_order ON announcements(enabled, position);
