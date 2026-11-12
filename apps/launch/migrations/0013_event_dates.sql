-- 活動日期（YYYY-MM-DD）：event_start 開始日，event_end 結束日（連續 2～3 天的活動；單日為空）。
ALTER TABLE courses ADD COLUMN event_start TEXT;
ALTER TABLE courses ADD COLUMN event_end TEXT;
