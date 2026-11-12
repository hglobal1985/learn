-- 課程海報（EDM）與封面圖。
-- EDM：直式海報，原圖壓縮後存 R2（edm/…，公開，可下載）。封面：管理員在瀏覽器合成的 16:9 圖（cover/…，公開）。
-- 封面底圖圖庫：內建底圖＋管理人員自訂上傳（bg/…）；只有具課程編輯權限的人看得到圖庫與上傳者資訊。
ALTER TABLE courses ADD COLUMN edm_key TEXT;
ALTER TABLE courses ADD COLUMN cover_key TEXT;
ALTER TABLE courses ADD COLUMN cover_bg_id TEXT;
ALTER TABLE courses ADD COLUMN art_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE cover_backgrounds (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  uploader_sub TEXT NOT NULL DEFAULT '',
  uploader_name TEXT NOT NULL DEFAULT '',
  uploader_center TEXT NOT NULL DEFAULT '',
  builtin INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO cover_backgrounds (id, r2_key, uploader_name, builtin) VALUES
  ('builtin-1', 'bg/builtin-1.jpg', '系統內建（鼠尾草綠）', 1),
  ('builtin-2', 'bg/builtin-2.jpg', '系統內建（暖沙）', 1),
  ('builtin-3', 'bg/builtin-3.jpg', '系統內建（海藍）', 1),
  ('builtin-4', 'bg/builtin-4.jpg', '系統內建（暮色）', 1),
  ('builtin-5', 'bg/builtin-5.jpg', '系統內建（墨黑）', 1);
