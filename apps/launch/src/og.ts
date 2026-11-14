import type { D1Database } from "./d1.ts";

const SITE = "寰宇行動大學";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 分享預覽（LINE、Facebook…讀的是網頁原始碼，不會執行 JavaScript）：
 * 把 index.html 的標題與分享標籤換成指定內容。
 */
export function withShareMeta(html: string, m: { title: string; description: string; url: string; image: string }): string {
  const t = esc(m.title);
  const d = esc(m.description);
  const tags = [
    `<meta name="description" content="${d}"/>`,
    `<meta property="og:site_name" content="${SITE}"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:title" content="${t}"/>`,
    `<meta property="og:description" content="${d}"/>`,
    `<meta property="og:url" content="${esc(m.url)}"/>`,
    `<meta property="og:image" content="${esc(m.image)}"/>`,
    `<meta name="twitter:card" content="summary"/>`,
  ].join("");
  const stripped = html.replace(/<meta (?:name="(?:description|twitter:card)"|property="og:[a-z_:]+")[^>]*>/g, "");
  return stripped.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`).replace("</head>", `${tags}</head>`);
}

/** 短網址的分享預覽：標題「{名稱} | 寰宇行動大學」，說明是隨機一句學習金句（設定頁編輯的那份）。找不到短網址回 null。 */
export async function shortLinkMeta(db: D1Database, slug: string, origin: string): Promise<{ title: string; description: string; url: string; image: string } | null> {
  const row = await db.prepare("SELECT value FROM short_links WHERE slug = ?").bind(slug).first<{ value: string }>();
  if (!row) return null;
  const q = await db.prepare("SELECT body FROM quotes ORDER BY RANDOM() LIMIT 1").first<{ body: string }>().catch(() => null);
  return { title: `${row.value} | ${SITE}`, description: q?.body?.trim() || SITE, url: `${origin}/${slug}`, image: `${origin}/icon-512.png` };
}
