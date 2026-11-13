/**
 * 統計分析（本 App 的 D1 資料庫）：只統計我們自己存的資料（課程、報名、學習、留言…），
 * 不含 Mux 影片數據、也不含 Cloudflare 流量。每一區塊獨立讀取，讀不到只顯示該區原因。
 */
import type { MuxStats, StatBlock } from "./contract.ts";
import type { D1Database } from "./d1.ts";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const fmt = (v: number) => v.toLocaleString("en-US");

async function one(db: D1Database, sql: string): Promise<Record<string, unknown>> {
  return (await db.prepare(sql).first<Record<string, unknown>>()) ?? {};
}

async function block(id: string, title: string, level: StatBlock["level"], run: () => Promise<Partial<StatBlock>>): Promise<StatBlock> {
  try {
    return { id, title, level, ...(await run()) };
  } catch {
    return { id, title, level, error: "讀取失敗，請稍後再試" };
  }
}

export async function collectAppStats(db: D1Database): Promise<MuxStats> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const blocks = await Promise.all([
    block("app_signups", "報名與開通", "core", async () => {
      const o = await one(db, `SELECT COUNT(*) total, SUM(status='pending') pending, SUM(status='opened') opened, SUM(status='rejected') rejected, COALESCE(SUM(CASE WHEN status='opened' THEN total_twd END),0) paid FROM orders`);
      const r = await one(db, `SELECT COUNT(*) c FROM orders WHERE created_at >= '${since}'`);
      const e = await one(db, `SELECT COUNT(*) c, COUNT(DISTINCT member_sub) m FROM enrollments`);
      return {
        stats: [
          { label: "報名紀錄總數", value: fmt(n(o.total)), sub: `近 30 天 ${fmt(n(r.c))} 筆` },
          { label: "待審核", value: fmt(n(o.pending)) },
          { label: "已開通", value: fmt(n(o.opened)) },
          { label: "未通過", value: fmt(n(o.rejected)) },
          { label: "已開通的報名金額合計", value: `NT$${fmt(n(o.paid))}` },
          { label: "開通的課程人次", value: fmt(n(e.c)), sub: `${fmt(n(e.m))} 位學員` },
        ],
      };
    }),
    block("app_learning", "學習進度", "core", async () => {
      const p = await one(db, `SELECT COUNT(*) c, COUNT(DISTINCT member_sub) m FROM lesson_progress`);
      const r = await one(db, `SELECT COUNT(*) c, COUNT(DISTINCT member_sub) m FROM lesson_progress WHERE completed_at >= '${since}'`);
      return {
        stats: [
          { label: "已完成章節（累計）", value: fmt(n(p.c)), sub: `${fmt(n(p.m))} 位學員` },
          { label: "近 30 天完成章節", value: fmt(n(r.c)), sub: `${fmt(n(r.m))} 位學員` },
        ],
      };
    }),
    block("app_courses", "課程與內容", "more", async () => {
      const c = await one(db, `SELECT COUNT(*) total, SUM(status='published') pub, SUM(status='draft') draft, SUM(status='archived') arch FROM courses`);
      const l = await one(db, `SELECT COUNT(*) c FROM lessons`);
      const cm = await one(db, `SELECT COUNT(*) c, SUM(status='hidden') h FROM course_comments`);
      return {
        stats: [
          { label: "課程總數", value: fmt(n(c.total)), sub: `上架 ${fmt(n(c.pub))}・草稿 ${fmt(n(c.draft))}・封存 ${fmt(n(c.arch))}` },
          { label: "章節總數", value: fmt(n(l.c)) },
          { label: "留言總數", value: fmt(n(cm.c)), sub: `已隱藏 ${fmt(n(cm.h))}` },
        ],
      };
    }),
    block("app_members", "會員與登入", "more", async () => {
      const m = await one(db, `SELECT COUNT(*) c FROM member_contacts`);
      const s = await one(db, `SELECT COUNT(DISTINCT member_sub) m FROM sessions WHERE expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')`);
      const a = await one(db, `SELECT COUNT(*) c FROM member_achievements`);
      return {
        note: "只統計曾登入過本 App 的會員（資料來自中央會員系統同步，本 App 不保存其他個資）。",
        stats: [
          { label: "曾登入的會員", value: fmt(n(m.c)) },
          { label: "目前登入中的會員", value: fmt(n(s.m)) },
          { label: "已頒發的學習成就", value: fmt(n(a.c)) },
        ],
      };
    }),
    block("app_size", "資料庫大小", "more", async () => {
      const r = await db.prepare("SELECT 1").all();
      const bytes = n((r.meta as { size_after?: number } | undefined)?.size_after);
      return { stats: [{ label: "D1 資料庫大小", value: bytes ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : "無法取得" }] };
    }),
  ]);
  return { generatedAt: new Date().toISOString(), freeMinutes: 0, blocks };
}
