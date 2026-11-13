-- 課程可設定「不顯示首頁推薦」。
ALTER TABLE courses ADD COLUMN hide_home INTEGER NOT NULL DEFAULT 0;
