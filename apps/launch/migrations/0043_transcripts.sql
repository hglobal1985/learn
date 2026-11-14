-- 章節逐字稿（試做）：每段音檔轉出的文字分段存放，可中斷、隔天接著做。
CREATE TABLE lesson_transcripts (
  lesson_id TEXT PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  parts_total INTEGER NOT NULL,
  model TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE lesson_transcript_parts (
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  part INTEGER NOT NULL,
  text TEXT NOT NULL,
  minutes REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (lesson_id, part)
);
