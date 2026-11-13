-- 清掉「連到已不存在的報名紀錄」的通知（會員刪除帳號、取消報名後遺留的），點了只會顯示「找不到這筆報名」。
DELETE FROM notifications WHERE link LIKE '/admin/orders/%' AND substr(link, 15) NOT IN (SELECT id FROM orders);
DELETE FROM notifications WHERE link LIKE '/orders/%' AND substr(link, 9) NOT IN (SELECT id FROM orders);
