/** 縮寫規則：小寫英文字母、數字、連字號，2～30 字，不能以連字號開頭或結尾。 */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])$/;

/** 網站本身的頁面路徑，不能拿來當縮寫（否則短網址會蓋掉正常頁面）。 */
export const RESERVED_SLUGS = new Set([
  "courses", "course", "learn", "learning", "notices", "me", "admin", "orders", "settings", "achievements", "auth",
  "privacy", "support", "api", "assets", "static", "login", "logout", "home", "index", "app", "www", "c", "s",
]);
