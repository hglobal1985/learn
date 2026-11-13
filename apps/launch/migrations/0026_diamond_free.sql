-- 課程可設定「鑽石免費」：鑽石（含）以上獎銜的會員報名費用為 0。
ALTER TABLE courses ADD COLUMN diamond_free INTEGER NOT NULL DEFAULT 0;
