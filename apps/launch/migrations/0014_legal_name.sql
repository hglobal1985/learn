-- 付費課程對帳用：報名當下的「真實姓名」快照（業主 2026-11-13 核准；中央會員欄位 legal_name）。
-- 只有付費報名才存；只有本人與有權限的審核人員／管理員看得到；刪除學習資料時隨報名紀錄一併刪除。
ALTER TABLE orders ADD COLUMN legal_name TEXT NOT NULL DEFAULT '';
