-- 「學習中」清單：學員播放任一章節超過 1% 就記錄一筆（不論是否報名、是否免費），之後出現在學習中。
-- hidden＝學員按 X 從學習中隱藏（有報名紀錄的課程，隱藏狀態存在 enrollments.hidden）。
CREATE TABLE learning_started (
  member_sub TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (member_sub, course_id)
);
