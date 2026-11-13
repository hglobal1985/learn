-- 課程「系列」：同系列的課在清單上只顯示最近的一場（各梯次仍是各自獨立的課程）。空字串＝不合併。
ALTER TABLE courses ADD COLUMN series TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_courses_series ON courses(series);
