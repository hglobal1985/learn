-- 每一則章節也有「活動日期」（YYYY-MM-DD，可空）；課程新增「完全公開」旗標（未登入訪客也能瀏覽與觀看，只限免費課程）。
ALTER TABLE lessons ADD COLUMN event_date TEXT;
ALTER TABLE courses ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
