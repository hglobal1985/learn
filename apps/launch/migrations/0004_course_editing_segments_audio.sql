-- 課程可由管理員新增／修改；章節支援同一影片的時間軸分段（start_seconds～end_seconds）與 R2 音檔（media_type = 'audio'，media_ref 為 R2 物件鍵）。
PRAGMA defer_foreign_keys = true;

ALTER TABLE courses ADD COLUMN description TEXT NOT NULL DEFAULT '';

CREATE TABLE lessons_new (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  media_type TEXT NOT NULL DEFAULT 'demo' CHECK (media_type IN ('demo', 'youtube', 'mux', 'audio')),
  media_ref TEXT,
  start_seconds INTEGER CHECK (start_seconds IS NULL OR start_seconds >= 0),
  end_seconds INTEGER CHECK (end_seconds IS NULL OR end_seconds > COALESCE(start_seconds, 0)),
  UNIQUE (course_id, position)
);
-- 重建 lessons 會觸發 lesson_progress 的串聯刪除，先備份再還原。
CREATE TABLE lesson_progress_backup AS SELECT * FROM lesson_progress;
INSERT INTO lessons_new (id, course_id, position, title, duration_minutes, media_type, media_ref)
  SELECT id, course_id, position, title, duration_minutes, media_type, media_ref FROM lessons;
DROP TABLE lessons;
ALTER TABLE lessons_new RENAME TO lessons;
INSERT OR IGNORE INTO lesson_progress SELECT * FROM lesson_progress_backup;
DROP TABLE lesson_progress_backup;
