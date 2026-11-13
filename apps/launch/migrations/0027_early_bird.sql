-- 早鳥優惠：early_bird=1 時，台灣時間 early_until（含當天）之前報名費用為 early_price_twd。
ALTER TABLE courses ADD COLUMN early_bird INTEGER NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN early_price_twd INTEGER;
ALTER TABLE courses ADD COLUMN early_until TEXT;
