-- 第一批：指導／主辦單位、限時免費、場次、審核群組、報名審核流程（操作紀錄、留言、備註）、依中心／職務的通知。
ALTER TABLE courses ADD COLUMN guidance_unit TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN host_unit TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN host_center_key TEXT;
ALTER TABLE courses ADD COLUMN free_from TEXT;
ALTER TABLE courses ADD COLUMN free_until TEXT;
ALTER TABLE courses ADD COLUMN review_group_id TEXT;

-- 場次：定期舉辦的系列課程，每場各自報名、繳費、審核。price_twd 為 NULL 時沿用課程費用。
CREATE TABLE course_runs (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TEXT,
  location TEXT NOT NULL DEFAULT '',
  register_until TEXT,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  price_twd INTEGER CHECK (price_twd IS NULL OR price_twd >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_course_runs_course ON course_runs(course_id, starts_at);

-- 章節可屬於某一場（只有報名該場的學員可看）；NULL 表示整個系列共用。
ALTER TABLE lessons ADD COLUMN run_id TEXT REFERENCES course_runs(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN run_id TEXT NOT NULL DEFAULT '';

-- 開通紀錄改為每場一筆（run_id = '' 表示不分場次的課程）。
CREATE TABLE enrollments_new (
  member_sub TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id),
  run_id TEXT NOT NULL DEFAULT '',
  source_order_id TEXT NOT NULL REFERENCES orders(id),
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (member_sub, course_id, run_id)
);
INSERT INTO enrollments_new (member_sub, course_id, source_order_id, granted_at) SELECT member_sub, course_id, source_order_id, granted_at FROM enrollments;
DROP TABLE enrollments;
ALTER TABLE enrollments_new RENAME TO enrollments;

-- 報名紀錄：報名當下的中心（業主 2026-11-12 核准保存中心名稱，用於分派審核與對帳）、繳費資訊（預留金流）。
ALTER TABLE orders ADD COLUMN center_key TEXT;
ALTER TABLE orders ADD COLUMN center_label TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN hglobal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN deferred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN paid_twd INTEGER;
ALTER TABLE orders ADD COLUMN pay_method TEXT CHECK (pay_method IS NULL OR pay_method IN ('cash', 'transfer', 'vip', 'online', 'free'));
ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN revoked_at TEXT;
CREATE INDEX idx_orders_center ON orders(center_key, status, created_at);

-- 操作紀錄：每一步由誰、何時、做了什麼。message 雙方可見；note 只有審核人員可見。
CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_sub TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_title TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL CHECK (action IN ('submit', 'paid', 'vip', 'reject', 'defer', 'revoke', 'message', 'note')),
  reason_code TEXT,
  message TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_order_events_order ON order_events(order_id, created_at);

-- 審核群組：一個群組可套用到多門課；成員依中心分列（center_key = '' 表示全部中心的總窗口）。
-- owner_center_key 為 NULL 表示總部群組（只有秘書與超級管理員可管理）。
CREATE TABLE review_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_center_key TEXT,
  owner_center_label TEXT NOT NULL DEFAULT '',
  created_by_sub TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE review_group_members (
  group_id TEXT NOT NULL REFERENCES review_groups(id) ON DELETE CASCADE,
  center_key TEXT NOT NULL DEFAULT '',
  center_label TEXT NOT NULL DEFAULT '',
  member_sub TEXT NOT NULL,
  member_name TEXT NOT NULL DEFAULT '',
  duty TEXT NOT NULL CHECK (duty IN ('register', 'collect', 'review')),
  added_by_sub TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (group_id, center_key, member_sub, duty)
);
CREATE INDEX idx_review_group_members_sub ON review_group_members(member_sub);

-- 通知可寄給「某中心的會長」這個身分（recipient_role = 'president' + recipient_center_key），換人不必改設定。
CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY,
  recipient_sub TEXT,
  recipient_role TEXT CHECK (recipient_role IN ('admin', 'president')),
  recipient_center_key TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '/',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((recipient_sub IS NULL) <> (recipient_role IS NULL))
);
INSERT INTO notifications_new (id, recipient_sub, recipient_role, title, body, link, read_at, created_at)
  SELECT id, recipient_sub, recipient_role, title, body, link, read_at, created_at FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;
CREATE INDEX idx_notifications_sub ON notifications(recipient_sub, created_at);
CREATE INDEX idx_notifications_role ON notifications(recipient_role, recipient_center_key, created_at);
