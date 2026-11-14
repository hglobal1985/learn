-- 分類／系列的英文短網址：learn.hglobal1985.com/c/<縮寫>（分類）、/s/<縮寫>（系列），由超級管理員在「設定 → 短網址」自訂。
CREATE TABLE short_links (
  slug TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('category', 'series')),
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kind, value)
);
