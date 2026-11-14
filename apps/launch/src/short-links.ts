import type { D1Database } from "./d1.ts";

/** 縮寫規則：小寫英文字母、數字、連字號，2～30 字，不能以連字號開頭或結尾。 */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])$/;

export type ShortKind = "category" | "series";

/** 短網址路徑 → 全部課程頁的篩選網址；找不到回 null。 */
export async function resolveShortLink(db: D1Database, pathname: string): Promise<string | null> {
  const m = /^\/(c|s)\/([a-z0-9-]{2,30})\/?$/.exec(pathname);
  if (!m) return null;
  const kind: ShortKind = m[1] === "c" ? "category" : "series";
  const row = await db.prepare("SELECT value FROM short_links WHERE slug = ? AND kind = ?").bind(m[2], kind).first<{ value: string }>();
  if (!row) return null;
  return `/courses?${kind}=${encodeURIComponent(row.value)}`;
}
