-- 章節附件教材（PDF、簡報、文件、壓縮檔…）：檔案放 R2（bucket learn，鍵 files/<章節>/<uuid>.<副檔名>），這裡只存清單。
CREATE TABLE lesson_attachments (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  name TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_lesson_attachments_lesson ON lesson_attachments(lesson_id, created_at);
CREATE INDEX idx_lesson_attachments_course ON lesson_attachments(course_id);
