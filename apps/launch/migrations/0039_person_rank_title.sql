-- 主講人（課程）與分享者（章節）的「獎銜」「職稱」：獎銜存中央獎銜代碼（選單來自會員中心），職稱是自由文字（輸入時有中央詞庫建議，可自己打）。
ALTER TABLE courses ADD COLUMN teacher_rank TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN teacher_title TEXT NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN sharer_rank TEXT NOT NULL DEFAULT '';
ALTER TABLE lessons ADD COLUMN sharer_title TEXT NOT NULL DEFAULT '';
