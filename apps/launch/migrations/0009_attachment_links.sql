-- 附件除了上傳檔案，也可以是網址（YouTube、Canva、Google 簡報、一般網頁…）：自訂顯示標題，並記下判斷出的類型（畫面依類型顯示圖示）。
-- r2_key 要改成可為空，SQLite 只能重建資料表（附件剛上線，重建前後資料原樣複製）。
CREATE TABLE lesson_attachments_new (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  name TEXT NOT NULL,
  r2_key TEXT UNIQUE,
  size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'file' CHECK (kind IN ('file', 'link')),
  link_url TEXT,
  att_type TEXT NOT NULL DEFAULT 'file',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((kind = 'file' AND r2_key IS NOT NULL) OR (kind = 'link' AND link_url IS NOT NULL))
);
INSERT INTO lesson_attachments_new (id, lesson_id, course_id, name, r2_key, size, content_type, kind, att_type, created_by, created_at)
  SELECT id, lesson_id, course_id, name, r2_key, size, content_type, 'file',
         CASE lower(substr(name, instr(name, '.') + 1)) WHEN 'pdf' THEN 'pdf' ELSE 'file' END, created_by, created_at
  FROM lesson_attachments;
DROP TABLE lesson_attachments;
ALTER TABLE lesson_attachments_new RENAME TO lesson_attachments;
CREATE INDEX idx_lesson_attachments_lesson ON lesson_attachments(lesson_id, created_at);
CREATE INDEX idx_lesson_attachments_course ON lesson_attachments(course_id);
