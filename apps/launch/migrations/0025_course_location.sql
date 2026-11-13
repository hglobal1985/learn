-- 課程「地點」；location_none=1 表示「無」，公開課程卡不顯示地點。
ALTER TABLE courses ADD COLUMN location TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN location_none INTEGER NOT NULL DEFAULT 0;
