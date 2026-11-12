/**
 * Email 通知：把「尚未寄出」的站內通知依收件人的設定寄出（Cloudflare Email Service，Worker 綁定 EMAIL）。
 * - 站內通知永遠保留；Email 只是多一個管道，學員可在「通知設定」關閉。
 * - 沒有設定 EMAIL 綁定（或沒有寄件地址）就完全不動作，通知維持原樣。
 * - 失敗不影響主流程；信箱不寫入日誌。
 */
import type { D1PreparedStatement, Env } from "./d1.ts";

export interface Mailer {
  send(msg: { from: { email: string; name: string }; to: string; subject: string; text: string; html: string }): Promise<unknown>;
}

const SITE = "https://learn.hglobal1985.com";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function mailerOf(env: Env): { mailer: Mailer; from: string } | null {
  const mailer = env.EMAIL;
  const from = env.EMAIL_FROM;
  return mailer && from ? { mailer, from } : null;
}

type Pending = { id: string; recipient_sub: string | null; recipient_role: string | null; recipient_center_key: string | null; title: string; body: string; link: string };

/** 寄出最近 30 分鐘內、尚未處理的通知。回傳寄出的封數。 */
export async function flushEmails(env: Env): Promise<number> {
  const m = mailerOf(env);
  if (!m) return 0;
  const db = env.DB;
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { results } = await db
    .prepare("SELECT id, recipient_sub, recipient_role, recipient_center_key, title, body, link FROM notifications WHERE emailed_at IS NULL AND created_at >= ? ORDER BY created_at LIMIT 20")
    .bind(since)
    .all<Pending>();
  let sent = 0;
  for (const n of results) {
    // 先標記再寄：寧可漏寄也不重複寄（站內通知仍在）。
    const claim = await db.prepare("UPDATE notifications SET emailed_at = ? WHERE id = ? AND emailed_at IS NULL").bind(new Date().toISOString(), n.id).run();
    if (claim.meta?.changes === 0) continue;
    const to = await recipients(db, n);
    for (const email of to) {
      try {
        const link = `${SITE}${n.link.startsWith("/") ? n.link : `/${n.link}`}`;
        const text = `${n.body ? `${n.body}\n\n` : ""}查看詳情：${link}\n\n——\n寰宇行動大學。不想收到 Email：登入後到「我的 → 通知設定」關閉。`;
        const html = `<div style="font-family:sans-serif;line-height:1.6"><h3>${esc(n.title)}</h3><p>${esc(n.body).replace(/\n/g, "<br>")}</p><p><a href="${esc(link)}">查看詳情</a></p><hr><p style="color:#888;font-size:12px">寰宇行動大學。不想收到 Email：登入後到「我的 → 通知設定」關閉。</p></div>`;
        await m.mailer.send({ from: { email: m.from, name: "寰宇行動大學" }, to: email, subject: n.title, text, html });
        sent++;
      } catch (e) {
        console.error("email send failed", e instanceof Error ? e.message : "error");
      }
    }
  }
  return sent;
}

async function recipients(db: Env["DB"], n: Pending): Promise<string[]> {
  let stmt: D1PreparedStatement;
  if (n.recipient_sub) stmt = db.prepare("SELECT email FROM member_contacts WHERE member_sub = ? AND notify_email = 1 AND email IS NOT NULL").bind(n.recipient_sub);
  else if (n.recipient_role === "admin") stmt = db.prepare("SELECT email FROM member_contacts WHERE is_admin = 1 AND notify_email = 1 AND email IS NOT NULL");
  else if (n.recipient_role === "president" && n.recipient_center_key) stmt = db.prepare("SELECT email FROM member_contacts WHERE president_center_key = ? AND notify_email = 1 AND email IS NOT NULL").bind(n.recipient_center_key);
  else return [];
  const { results } = await stmt.all<{ email: string }>();
  return [...new Set(results.map((r) => r.email))];
}
