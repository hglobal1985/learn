-- EDM 預設停留位置（原圖高度的比例 0～1，課程介紹頁一進來停在這個位置，可上下拖曳）。
-- 封面（cover_key）＝管理員從 EDM 裁切出來的 16:9 橫式縮圖，用在課程清單。
ALTER TABLE courses ADD COLUMN edm_view_y REAL NOT NULL DEFAULT 0;
