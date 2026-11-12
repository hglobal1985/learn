-- 中央會員 webhook：記下已處理的事件編號（去重用，只存編號與時間，不含任何個資）。
CREATE TABLE central_events (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 不再保存聯絡信箱副本：寄信時才向中央查詢（中央新標準 no_email_copy）。清掉既有副本。
UPDATE member_contacts SET email = NULL;
