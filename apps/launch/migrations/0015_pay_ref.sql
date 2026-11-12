-- 付款代碼：每筆付費報名一組唯一代碼（匯款備註填寫，對帳時用代碼對款項，不靠姓名比對）。
ALTER TABLE orders ADD COLUMN pay_ref TEXT NOT NULL DEFAULT '';
UPDATE orders SET pay_ref = 'P' || upper(substr(hex(randomblob(5)), 1, 8)) WHERE total_twd > 0 AND pay_ref = '';
CREATE UNIQUE INDEX idx_orders_pay_ref ON orders(pay_ref) WHERE pay_ref <> '';
