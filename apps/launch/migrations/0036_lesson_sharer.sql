-- 每個章節可以填「分享者」（該章節的講者／分享人）。
ALTER TABLE lessons ADD COLUMN sharer TEXT NOT NULL DEFAULT '';
