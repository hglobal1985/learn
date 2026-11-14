-- Claude 每月花費（微美元＝1/1,000,000 美元，整數記帳；月份為 UTC「YYYY-MM」，隔月自動歸零）。
CREATE TABLE ai_spend (
  month TEXT PRIMARY KEY,
  micro_usd INTEGER NOT NULL DEFAULT 0
);
