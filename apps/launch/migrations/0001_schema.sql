-- 寰宇行動大學 V2 資料表。身分與獎銜來自中央會員（目前為模擬會員），
-- 這裡只存 App 自己的資料，以 member_sub 參照會員，不複製會員資料表。
CREATE TABLE ranks (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  teacher TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '一般',
  price_twd INTEGER NOT NULL DEFAULT 0 CHECK (price_twd >= 0),
  min_rank_code TEXT NOT NULL DEFAULT 'none' REFERENCES ranks(code),
  theme TEXT NOT NULL DEFAULT 'sage',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_courses_catalog ON courses(status, sort_order);

CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  media_type TEXT NOT NULL DEFAULT 'demo' CHECK (media_type IN ('demo', 'mux', 'youtube')),
  media_ref TEXT,
  UNIQUE (course_id, position)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  member_sub TEXT NOT NULL,
  member_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'opened', 'rejected')),
  total_twd INTEGER NOT NULL CHECK (total_twd >= 0),
  reject_reason TEXT,
  reviewed_by_sub TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_orders_member ON orders(member_sub, created_at);
CREATE INDEX idx_orders_status ON orders(status, created_at);

CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id),
  title_snapshot TEXT NOT NULL,
  price_twd INTEGER NOT NULL CHECK (price_twd >= 0),
  PRIMARY KEY (order_id, course_id)
);
CREATE INDEX idx_order_items_course ON order_items(course_id);

-- 已開通的課程（學習權限的唯一依據）。
CREATE TABLE enrollments (
  member_sub TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id),
  source_order_id TEXT NOT NULL REFERENCES orders(id),
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (member_sub, course_id)
);

CREATE TABLE lesson_progress (
  member_sub TEXT NOT NULL,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (member_sub, lesson_id)
);

-- 站內通知：寄給單一會員（recipient_sub）或全體管理員（recipient_role = 'admin'）。
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_sub TEXT,
  recipient_role TEXT CHECK (recipient_role IN ('admin')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '/',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((recipient_sub IS NULL) <> (recipient_role IS NULL))
);
CREATE INDEX idx_notifications_sub ON notifications(recipient_sub, created_at);
CREATE INDEX idx_notifications_role ON notifications(recipient_role, created_at);

-- 登入工作階段：只存 token 的 SHA-256。身分快照來自登入來源（現為模擬會員）。
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  member_sub TEXT NOT NULL,
  display_name TEXT NOT NULL,
  rank_code TEXT NOT NULL REFERENCES ranks(code),
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_member ON sessions(member_sub);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_sub TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
