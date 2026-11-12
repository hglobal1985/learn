-- 「會長也可報名」的課程條件；課程留言板（含檢舉、封鎖、管理員隱藏）。
ALTER TABLE courses ADD COLUMN allow_president INTEGER NOT NULL DEFAULT 0;

CREATE TABLE course_comments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  member_sub TEXT NOT NULL,
  member_name TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  hidden_by_sub TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_course_comments_course ON course_comments(course_id, created_at);
CREATE INDEX idx_course_comments_member ON course_comments(member_sub, created_at);

CREATE TABLE comment_reports (
  comment_id TEXT NOT NULL REFERENCES course_comments(id) ON DELETE CASCADE,
  reporter_sub TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (comment_id, reporter_sub)
);

-- 封鎖：member_sub 不再看到 blocked_sub 的留言。
CREATE TABLE comment_blocks (
  member_sub TEXT NOT NULL,
  blocked_sub TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (member_sub, blocked_sub)
);
