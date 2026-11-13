-- 線上課程：勾選後，課程的地點顯示為「線上課程」。
ALTER TABLE courses ADD COLUMN is_online INTEGER NOT NULL DEFAULT 0;
