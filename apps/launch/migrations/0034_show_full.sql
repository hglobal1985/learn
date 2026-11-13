-- 課程可設定是否顯示「完整版」（同一支影片被裁成多段時自動多出的整支播放區塊）；預設顯示。
ALTER TABLE courses ADD COLUMN show_full INTEGER NOT NULL DEFAULT 1;
