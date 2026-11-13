-- 學員可以把免費課程從「學習中」隱藏（付費課程不行）。再點進該課程會自動恢復顯示。
ALTER TABLE enrollments ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
