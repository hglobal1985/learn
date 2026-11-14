-- 章節各自的封面：課程勾選 chapter_covers 後，每個章節可設定自己的橫式（16:9 清單縮圖）與直式封面；沒設定就用課程封面。
ALTER TABLE courses ADD COLUMN chapter_covers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lessons ADD COLUMN cover_key TEXT;
ALTER TABLE lessons ADD COLUMN poster_key TEXT;
ALTER TABLE lessons ADD COLUMN art_version INTEGER NOT NULL DEFAULT 1;
