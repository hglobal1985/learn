-- 獎銜代碼改為與中央會員一致（GET /v1/amway/field-definitions 的 rank 選項，2026-11-10 版階梯）。
-- 中央的「無」在本 App 代表「不限獎銜」。既有代碼（none/silver/gold/platinum/emerald/diamond）意義不變，只更新順序。
UPDATE ranks SET sort_order = sort_order + 10000;
INSERT INTO ranks (code, name, sort_order) VALUES
  ('none', '不限獎銜', 10), ('r03', '3%', 20), ('r06', '6%', 30), ('r09', '9%', 40), ('r12', '12%', 50),
  ('r12a', '12%初階', 60), ('r15', '15%', 70), ('r15b', '15%銅章', 80), ('r18', '18%', 90), ('r21', '21%', 100),
  ('silver', '銀章', 110), ('gold', '金章', 120), ('platinum', '白金', 130), ('ruby', '紅寶石', 140),
  ('f_platinum', '創辦人白金', 150), ('f_ruby', '創辦人紅寶石', 160), ('sapphire', '藍寶石', 170),
  ('f_sapphire', '創辦人藍寶石', 180), ('pearl', '明珠', 190), ('emerald', '翡翠', 200), ('f_emerald', '創辦人翡翠', 210),
  ('diamond', '鑽石', 220), ('f_diamond', '創辦人鑽石', 230), ('exec_diamond', '執行專才鑽石', 240),
  ('f_exec_diamond', '創辦人執行專才鑽石', 250), ('double_diamond', '雙鑽石', 260), ('f_double_diamond', '創辦人雙鑽石', 270),
  ('triple_diamond', '參鑽石', 280), ('f_triple_diamond', '創辦人參鑽石', 290), ('crown', '皇冠', 300),
  ('f_crown', '創辦人皇冠', 310), ('crown_ambassador', '皇冠大使', 320), ('f_crown_ambassador', '創辦人皇冠大使', 330)
ON CONFLICT (code) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order;
