-- 通知用的聯絡信箱「副本」與通知方式。
-- 信箱的正本在中央會員（個人資料「聯絡信箱」contact_email）；學員登入時同步一份過來，
-- 才能在對方不在線上時寄通知。學員在 App 修改時一律先寫回中央，再更新這份副本。
-- 刪除學習資料時整列刪除。不記錄在稽核紀錄或日誌。
CREATE TABLE member_contacts (
  member_sub TEXT PRIMARY KEY,
  email TEXT,
  notify_email INTEGER NOT NULL DEFAULT 1,
  is_admin INTEGER NOT NULL DEFAULT 0,
  president_center_key TEXT,
  synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_member_contacts_center ON member_contacts(president_center_key);

-- 站內通知寄出 Email 的時間（NULL＝尚未處理）；既有通知視為已處理，避免啟用時補寄舊信。
ALTER TABLE notifications ADD COLUMN emailed_at TEXT;
UPDATE notifications SET emailed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
