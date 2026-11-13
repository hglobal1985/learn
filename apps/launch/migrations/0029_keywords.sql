-- 超級管理員預先建立的關鍵字（分類、系列、場地）：課程編輯頁的「已有的…」選項會包含這些，即使目前還沒有課程使用。
CREATE TABLE keywords (
  kind TEXT NOT NULL CHECK (kind IN ('category', 'series', 'location')),
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (kind, value)
);
