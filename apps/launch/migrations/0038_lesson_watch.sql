-- 每位學員每一堂的「播放到哪」（最大比例 0～1）：還沒看完的章節也會讓課程進度條前進。看完（lesson_progress）另外記錄。
CREATE TABLE lesson_watch (
  member_sub TEXT NOT NULL,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  ratio REAL NOT NULL DEFAULT 0 CHECK (ratio >= 0 AND ratio <= 1),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (member_sub, lesson_id)
);
