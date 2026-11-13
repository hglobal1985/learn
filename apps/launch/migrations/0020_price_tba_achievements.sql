-- 費用「尚未公布」旗標：勾選後課程顯示「費用尚未公布」，暫不開放報名。
ALTER TABLE courses ADD COLUMN price_tba INTEGER NOT NULL DEFAULT 0;

-- 學習成就（徽章）：條件由超級管理員設定；會員達成後記錄取得時間。
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🏅',
  condition_type TEXT NOT NULL CHECK (condition_type IN ('lessons_completed', 'courses_completed', 'courses_enrolled', 'learning_days', 'comments_posted', 'course_completed')),
  threshold INTEGER NOT NULL DEFAULT 1,
  course_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE member_achievements (
  member_sub TEXT NOT NULL,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (member_sub, achievement_id)
);
CREATE INDEX idx_member_achievements_member ON member_achievements(member_sub);

INSERT INTO achievements (id, name, description, icon, condition_type, threshold, sort_order) VALUES
  ('ach-first-lesson', '初次學習', '完成第 1 堂課', '🌱', 'lessons_completed', 1, 1),
  ('ach-10-lessons', '學習新星', '累計完成 10 堂課', '⭐', 'lessons_completed', 10, 2),
  ('ach-50-lessons', '學習達人', '累計完成 50 堂課', '🏆', 'lessons_completed', 50, 3),
  ('ach-first-course', '完課成就', '完整學完 1 門課程', '🎓', 'courses_completed', 1, 4),
  ('ach-7-days', '持之以恆', '累計 7 個不同的日子有學習紀錄', '🔥', 'learning_days', 7, 5),
  ('ach-comment', '熱情參與', '在課程留言板留言 3 次', '💬', 'comments_posted', 3, 6);
