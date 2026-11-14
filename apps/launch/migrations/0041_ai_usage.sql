-- AI 每日用量（Workers AI 的「點數」，用 UTC 日期當帳；隔天自動歸零）。
CREATE TABLE ai_usage (
  day TEXT PRIMARY KEY,
  neurons REAL NOT NULL DEFAULT 0
);
