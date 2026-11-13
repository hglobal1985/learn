-- 系列專屬 EDM：全部課程清單上，同系列的課共用這張圖；沒上傳就用系列名稱當大標題。
CREATE TABLE series_art (
  series TEXT PRIMARY KEY,
  edm_key TEXT NOT NULL,
  art_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
