import {
  DEMO_MEMBERS,
  type ClientPlatform,
  type CourseDetail,
  type CourseSummary,
  type Member,
  type Notice,
  type Order,
  type Rank,
} from "./contract.ts";
import { displayName, isAdmin, looksLikeJwt, rankEligibility, verifyAccessToken } from "./central.ts";
import type { D1Database, D1PreparedStatement, Env } from "./d1.ts";
import { listMuxAssets, MuxApiError, muxPlaybackUrl } from "./mux.ts";

const SESSION_DAYS = 30;
const DEMO_VIDEO_PATH = "/media/orientation.mp4";

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const fail = (status: number, code: string, message: string): never => {
  throw new HttpError(status, code, message);
};

/** demo：模擬會員（rankCode 為示範獎銜）；central：中央會員（不持有獎銜，資格每次向中央查詢）。 */
type Session =
  | { kind: "demo"; sub: string; name: string; rankCode: string; role: "student" | "admin" }
  | { kind: "central"; sub: string; name: string; role: "student" | "admin"; token: string };
type Ctx = { env: Env; db: D1Database; req: Request; url: URL; platform: ClientPlatform; session: Session | null };

// ---------- helpers ----------

function platformOf(req: Request): ClientPlatform {
  const p = req.headers.get("x-client-platform");
  return p === "ios" || p === "android" ? p : "web";
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function orderId(now: Date): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => alphabet[b % alphabet.length]).join("");
  return `ORD-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${rand}`;
}
const iso = (d = new Date()) => d.toISOString();

async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return fail(400, "bad_json", "請求格式錯誤");
  }
}

function requireMember(ctx: Ctx): Session {
  return ctx.session ?? fail(401, "unauthenticated", "請先登入");
}
function requireAdmin(ctx: Ctx): Session {
  const s = requireMember(ctx);
  if (s.role !== "admin") fail(403, "forbidden", "需要管理員權限");
  return s;
}

const demoEnabled = (env: Env) => env.DEMO_LOGIN === "on";

async function loadSession(env: Env, req: Request): Promise<Session | null> {
  const db = env.DB;
  const auth = req.headers.get("authorization") ?? "";
  const jwt = /^Bearer (\S+)$/.exec(auth)?.[1];
  if (jwt && looksLikeJwt(jwt)) {
    const sub = await verifyAccessToken(jwt);
    if (!sub) return null;
    const [name, admin] = await Promise.all([displayName(sub, jwt), isAdmin(sub, jwt)]);
    return { kind: "central", sub, name, role: admin ? "admin" : "student", token: jwt };
  }
  if (!demoEnabled(env)) return null;
  const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(auth);
  if (!m) return null;
  const row = await db
    .prepare("SELECT member_sub, display_name, rank_code, role FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await sha256(m[1]), iso())
    .first<{ member_sub: string; display_name: string; rank_code: string; role: "student" | "admin" }>();
  return row ? { kind: "demo", sub: row.member_sub, name: row.display_name, rankCode: row.rank_code, role: row.role } : null;
}

async function ranks(db: D1Database): Promise<Map<string, Rank>> {
  const { results } = await db.prepare("SELECT code, name, sort_order FROM ranks ORDER BY sort_order").all<{
    code: string;
    name: string;
    sort_order: number;
  }>();
  return new Map(results.map((r) => [r.code, { code: r.code, name: r.name, order: r.sort_order }]));
}

function memberOf(s: Session, rankMap: Map<string, Rank>): Member {
  // 中央會員的獎銜屬 Amway 資料，App 不取得也不顯示；只有模擬會員帶示範獎銜。
  if (s.kind === "central") return { sub: s.sub, name: s.name, role: s.role, rank: null, demo: false };
  return { sub: s.sub, name: s.name, role: s.role, rank: rankMap.get(s.rankCode) ?? null, demo: true };
}

/** 各最低獎銜是否符合：模擬會員比對示範獎銜；中央會員向中央查詢（fail closed）。 */
async function eligibilityFor(session: Session | null, rankMap: Map<string, Rank>, codes: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (!session) return out;
  if (session.kind === "central") return rankEligibility(session.sub, session.token, codes);
  const mine = rankMap.get(session.rankCode)?.order ?? -1;
  for (const c of codes) out.set(c, c === "none" || mine >= (rankMap.get(c)?.order ?? Infinity));
  return out;
}

function audit(db: D1Database, actor: string, action: string, type: string, id: string, detail = ""): D1PreparedStatement {
  return db
    .prepare("INSERT INTO audit_log (id, actor_sub, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actor, action, type, id, detail);
}

function notify(db: D1Database, to: { sub: string } | { role: "admin" }, title: string, body: string, link: string): D1PreparedStatement {
  return db
    .prepare("INSERT INTO notifications (id, recipient_sub, recipient_role, title, body, link) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), "sub" in to ? to.sub : null, "role" in to ? to.role : null, title, body, link);
}

// ---------- courses ----------

type CourseRow = {
  id: string;
  title: string;
  subtitle: string;
  teacher: string;
  category: string;
  price_twd: number;
  min_rank_code: string;
  theme: string;
  status: "draft" | "published" | "archived";
  lesson_count: number;
  total_minutes: number;
};

const COURSE_SELECT = `SELECT c.id, c.title, c.subtitle, c.teacher, c.category, c.price_twd, c.min_rank_code, c.theme, c.status,
  (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
  (SELECT COALESCE(SUM(duration_minutes), 0) FROM lessons l WHERE l.course_id = c.id) AS total_minutes
  FROM courses c`;

async function memberCourseState(db: D1Database, sub: string | undefined) {
  if (!sub) return { enrolled: new Set<string>(), pending: new Set<string>(), done: new Map<string, number>() };
  const [e, p, d] = await db.batch([
    db.prepare("SELECT course_id FROM enrollments WHERE member_sub = ?").bind(sub),
    db
      .prepare(
        "SELECT DISTINCT i.course_id FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.member_sub = ? AND o.status = 'pending'",
      )
      .bind(sub),
    db.prepare("SELECT course_id, COUNT(*) AS n FROM lesson_progress WHERE member_sub = ? GROUP BY course_id").bind(sub),
  ]);
  return {
    enrolled: new Set((e.results as { course_id: string }[]).map((r) => r.course_id)),
    pending: new Set((p.results as { course_id: string }[]).map((r) => r.course_id)),
    done: new Map((d.results as { course_id: string; n: number }[]).map((r) => [r.course_id, r.n])),
  };
}

function summarize(
  row: CourseRow,
  ctx: Ctx,
  rankMap: Map<string, Rank>,
  state: Awaited<ReturnType<typeof memberCourseState>>,
  eligibility: Map<string, boolean>,
): CourseSummary {
  const minRank = rankMap.get(row.min_rank_code) ?? { code: row.min_rank_code, name: row.min_rank_code, order: 9999 };
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    teacher: row.teacher,
    category: row.category,
    priceTwd: ctx.platform === "web" ? row.price_twd : null,
    free: row.price_twd === 0,
    minRank,
    theme: row.theme,
    status: row.status,
    lessonCount: row.lesson_count,
    totalMinutes: row.total_minutes,
    eligible: eligibility.get(row.min_rank_code) === true,
    enrollment: state.enrolled.has(row.id) ? "opened" : state.pending.has(row.id) ? "pending" : null,
    completedLessons: state.done.get(row.id) ?? 0,
  };
}

async function listCourses(ctx: Ctx, all: boolean): Promise<CourseSummary[]> {
  const where = all ? "" : " WHERE c.status = 'published'";
  const [{ results }, rankMap, state] = await Promise.all([
    ctx.db.prepare(`${COURSE_SELECT}${where} ORDER BY c.sort_order, c.created_at`).all<CourseRow>(),
    ranks(ctx.db),
    memberCourseState(ctx.db, ctx.session?.sub),
  ]);
  const eligibility = await eligibilityFor(ctx.session, rankMap, results.map((r) => r.min_rank_code));
  return results.map((r) => summarize(r, ctx, rankMap, state, eligibility));
}

async function courseDetail(ctx: Ctx, id: string): Promise<CourseDetail> {
  const row = await ctx.db.prepare(`${COURSE_SELECT} WHERE c.id = ?`).bind(id).first<CourseRow>();
  if (!row || (row.status !== "published" && ctx.session?.role !== "admin")) fail(404, "not_found", "找不到這門課程");
  const [rankMap, state, lessons, done] = await Promise.all([
    ranks(ctx.db),
    memberCourseState(ctx.db, ctx.session?.sub),
    ctx.db
      .prepare("SELECT id, position, title, duration_minutes, media_type, media_ref FROM lessons WHERE course_id = ? ORDER BY position")
      .bind(id)
      .all<{ id: string; position: number; title: string; duration_minutes: number; media_type: MediaType; media_ref: string | null }>(),
    ctx.session
      ? ctx.db.prepare("SELECT lesson_id FROM lesson_progress WHERE member_sub = ? AND course_id = ?").bind(ctx.session.sub, id).all<{ lesson_id: string }>()
      : Promise.resolve({ results: [] as { lesson_id: string }[] }),
  ]);
  const completed = new Set(done.results.map((r) => r.lesson_id));
  return {
    ...summarize(row!, ctx, rankMap, state, await eligibilityFor(ctx.session, rankMap, [row!.min_rank_code])),
    lessons: lessons.results.map((l) => ({
      id: l.id,
      position: l.position,
      title: l.title,
      minutes: l.duration_minutes,
      completed: completed.has(l.id),
      // 影片來源只給管理員（編輯用）；學員一律透過 playback API 取得授權後的播放資訊。
      ...(ctx.session?.role === "admin" ? { media: { type: l.media_type, ref: l.media_ref } } : {}),
    })),
  };
}

async function canWatch(ctx: Ctx, courseId: string): Promise<boolean> {
  const s = requireMember(ctx);
  if (s.role === "admin") return true;
  const row = await ctx.db.prepare("SELECT 1 AS ok FROM enrollments WHERE member_sub = ? AND course_id = ?").bind(s.sub, courseId).first();
  return !!row;
}

async function lessonOf(ctx: Ctx, courseId: string, lessonId: string) {
  const lesson = await ctx.db
    .prepare("SELECT l.id, l.media_type, l.media_ref FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? AND l.course_id = ?")
    .bind(lessonId, courseId)
    .first<{ id: string; media_type: MediaType; media_ref: string | null }>();
  return lesson ?? fail(404, "not_found", "找不到這個章節");
}

// ---------- orders ----------

type OrderRow = {
  id: string;
  status: Order["status"];
  total_twd: number;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  member_name_snapshot: string;
};

async function hydrateOrders(db: D1Database, rows: OrderRow[]): Promise<Order[]> {
  if (!rows.length) return [];
  const marks = rows.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT order_id, course_id, title_snapshot, price_twd FROM order_items WHERE order_id IN (${marks})`)
    .bind(...rows.map((r) => r.id))
    .all<{ order_id: string; course_id: string; title_snapshot: string; price_twd: number }>();
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    totalTwd: r.total_twd,
    rejectReason: r.reject_reason,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    memberName: r.member_name_snapshot,
    items: results.filter((i) => i.order_id === r.id).map((i) => ({ courseId: i.course_id, title: i.title_snapshot, priceTwd: i.price_twd })),
  }));
}

const ORDER_SELECT = "SELECT id, status, total_twd, reject_reason, created_at, reviewed_at, member_name_snapshot FROM orders";

async function createOrders(ctx: Ctx, body: { courseIds?: unknown }): Promise<Order[]> {
  const s = requireMember(ctx);
  const ids = Array.isArray(body.courseIds) ? [...new Set(body.courseIds.filter((x): x is string => typeof x === "string"))] : [];
  if (!ids.length || ids.length > 20) fail(400, "invalid_courses", "請選擇要領取的課程");
  const marks = ids.map(() => "?").join(",");
  const [{ results: courses }, rankMap, state] = await Promise.all([
    ctx.db.prepare(`SELECT id, title, price_twd, min_rank_code FROM courses WHERE status = 'published' AND id IN (${marks})`).bind(...ids).all<{
      id: string;
      title: string;
      price_twd: number;
      min_rank_code: string;
    }>(),
    ranks(ctx.db),
    memberCourseState(ctx.db, s.sub),
  ]);
  if (courses.length !== ids.length) fail(409, "unavailable", "課程已下架或不存在，請重新確認");
  const eligibility = await eligibilityFor(s, rankMap, courses.map((c) => c.min_rank_code));
  if (courses.some((c) => eligibility.get(c.min_rank_code) !== true)) fail(403, "rank_required", "獎銜資格不符，無法領取這門課程");
  if (courses.some((c) => state.enrolled.has(c.id) || state.pending.has(c.id))) fail(409, "duplicate", "已有已開通或待審核的訂單，請勿重複送出");
  const free = courses.filter((c) => c.price_twd === 0);
  const paid = courses.filter((c) => c.price_twd > 0);
  if (paid.length && ctx.platform !== "web") fail(403, "web_only", "付費課程請至網頁版辦理");

  const now = new Date();
  const statements: D1PreparedStatement[] = [];
  const created: string[] = [];
  for (const group of [free, paid]) {
    if (!group.length) continue;
    const id = orderId(now);
    const isFree = group === free;
    const total = group.reduce((sum, c) => sum + c.price_twd, 0);
    const titles = group.map((c) => c.title).join("、");
    created.push(id);
    statements.push(
      ctx.db
        .prepare("INSERT INTO orders (id, member_sub, member_name_snapshot, status, total_twd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, s.sub, s.name, isFree ? "opened" : "pending", total, iso(now)),
    );
    for (const c of group) {
      statements.push(
        ctx.db.prepare("INSERT INTO order_items (order_id, course_id, title_snapshot, price_twd) VALUES (?, ?, ?, ?)").bind(id, c.id, c.title, c.price_twd),
      );
      // 免費課程立即開通；PRIMARY KEY 保證同一會員同一課程只會開通一次（重複請求整批失敗）。
      if (isFree)
        statements.push(ctx.db.prepare("INSERT INTO enrollments (member_sub, course_id, source_order_id) VALUES (?, ?, ?)").bind(s.sub, c.id, id));
    }
    statements.push(
      notify(ctx.db, { sub: s.sub }, isFree ? "課程已開通" : "訂單已送出，等待人工審核", titles, isFree ? "/learning" : `/orders/${id}`),
      audit(ctx.db, s.sub, isFree ? "order.claim_free" : "order.submit", "order", id, titles),
    );
    if (!isFree) statements.push(notify(ctx.db, { role: "admin" }, "有新的訂單待審核", `${s.name} · NT$${total.toLocaleString("en-US")}`, `/admin/orders/${id}`));
  }
  try {
    await ctx.db.batch(statements);
  } catch {
    fail(409, "duplicate", "這門課程已經領取過了");
  }
  const { results } = await ctx.db.prepare(`${ORDER_SELECT} WHERE id IN (${created.map(() => "?").join(",")})`).bind(...created).all<OrderRow>();
  return hydrateOrders(ctx.db, results);
}

async function reviewOrder(ctx: Ctx, id: string, body: { approve?: unknown; reason?: unknown }): Promise<Order> {
  const admin = requireAdmin(ctx);
  if (ctx.platform !== "web") fail(403, "web_only", "訂單審核請至網頁版辦理");
  const approve = body.approve === true;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!approve && !reason) fail(400, "reason_required", "請填寫未通過原因");
  const order = await ctx.db.prepare("SELECT id, member_sub, status FROM orders WHERE id = ?").bind(id).first<{ id: string; member_sub: string; status: string }>();
  if (!order) return fail(404, "not_found", "找不到這筆訂單");
  if (order.status !== "pending") fail(409, "already_reviewed", "訂單已處理");
  const now = iso();
  const statements = [
    ctx.db
      .prepare("UPDATE orders SET status = ?, reject_reason = ?, reviewed_by_sub = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'")
      .bind(approve ? "opened" : "rejected", approve ? null : reason, admin.sub, now, id),
  ];
  if (approve)
    statements.push(
      ctx.db
        .prepare(
          "INSERT OR IGNORE INTO enrollments (member_sub, course_id, source_order_id) SELECT o.member_sub, i.course_id, o.id FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = ? AND o.status = 'opened'",
        )
        .bind(id),
    );
  statements.push(
    notify(
      ctx.db,
      { sub: order.member_sub },
      approve ? "付款確認完成，課程已開通" : "訂單審核未通過",
      approve ? "前往我的課程開始學習。" : reason,
      approve ? "/learning" : `/orders/${id}`,
    ),
    audit(ctx.db, admin.sub, approve ? "order.approve" : "order.reject", "order", id, reason),
  );
  const [update] = await ctx.db.batch(statements);
  if (update.meta?.changes === 0) fail(409, "already_reviewed", "訂單已處理");
  const row = await ctx.db.prepare(`${ORDER_SELECT} WHERE id = ?`).bind(id).first<OrderRow>();
  return (await hydrateOrders(ctx.db, [row!]))[0];
}

type MediaType = "demo" | "youtube" | "mux";

/** 接受 YouTube 網址（watch、youtu.be、shorts、embed）或 11 碼 ID。 */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^(www|m)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com")
      id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// ---------- router ----------

type Handler = (ctx: Ctx, params: string[]) => Promise<unknown>;
const routes: [string, RegExp, Handler][] = [
  ["GET", /^\/health$/, async () => ({ ok: true })],
  ["GET", /^\/ranks$/, async (ctx) => [...(await ranks(ctx.db)).values()]],
  ["GET", /^\/config$/, async (ctx) => ({ demoLogin: demoEnabled(ctx.env) })],
  [
    "GET",
    /^\/demo-members$/,
    async (ctx) => {
      if (!demoEnabled(ctx.env)) fail(404, "not_found", "找不到這個 API");
      const rankMap = await ranks(ctx.db);
      return DEMO_MEMBERS.map((m) => ({ sub: m.sub, name: m.name, role: m.role, rank: rankMap.get(m.rankCode), demo: true }));
    },
  ],
  [
    "POST",
    /^\/auth\/demo$/,
    async (ctx) => {
      if (!demoEnabled(ctx.env)) fail(404, "not_found", "找不到這個 API");
      const { sub } = await readJson<{ sub?: string }>(ctx.req);
      const m = DEMO_MEMBERS.find((x) => x.sub === sub) ?? fail(400, "unknown_member", "請選擇測試會員");
      const token = randomToken();
      const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
      await ctx.db
        .prepare("INSERT INTO sessions (token_hash, member_sub, display_name, rank_code, role, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(await sha256(token), m.sub, m.name, m.rankCode, m.role, iso(expires))
        .run();
      const session: Session = { kind: "demo", sub: m.sub, name: m.name, rankCode: m.rankCode, role: m.role };
      return { token, member: memberOf(session, await ranks(ctx.db)) };
    },
  ],
  [
    "POST",
    /^\/auth\/logout$/,
    async (ctx) => {
      const token = /^Bearer (.+)$/.exec(ctx.req.headers.get("authorization") ?? "")?.[1];
      if (token) await ctx.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
      return { ok: true };
    },
  ],
  ["GET", /^\/me$/, async (ctx) => ({ member: ctx.session ? memberOf(ctx.session, await ranks(ctx.db)) : null })],
  [
    "DELETE",
    /^\/me$/,
    async (ctx) => {
      // 模擬會員：清除這位會員在本 App 的所有資料。串接中央會員後改為導向官方刪除流程。
      const s = requireMember(ctx);
      await ctx.db.batch([
        ctx.db.prepare("DELETE FROM lesson_progress WHERE member_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM enrollments WHERE member_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM orders WHERE member_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM notifications WHERE recipient_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM sessions WHERE member_sub = ?").bind(s.sub),
        audit(ctx.db, s.sub, "member.delete_app_data", "member", s.sub),
      ]);
      return { ok: true };
    },
  ],
  ["GET", /^\/courses$/, async (ctx) => listCourses(ctx, false)],
  ["GET", /^\/courses\/([\w-]+)$/, async (ctx, [id]) => courseDetail(ctx, id)],
  [
    "POST",
    /^\/courses\/([\w-]+)\/lessons\/([\w-]+)\/complete$/,
    async (ctx, [courseId, lessonId]) => {
      const s = requireMember(ctx);
      await lessonOf(ctx, courseId, lessonId);
      if (!(await canWatch(ctx, courseId))) fail(403, "not_enrolled", "請先領取這門課程");
      await ctx.db
        .prepare("INSERT OR IGNORE INTO lesson_progress (member_sub, lesson_id, course_id) VALUES (?, ?, ?)")
        .bind(s.sub, lessonId, courseId)
        .run();
      return { ok: true };
    },
  ],
  [
    "GET",
    /^\/courses\/([\w-]+)\/lessons\/([\w-]+)\/playback$/,
    async (ctx, [courseId, lessonId]) => {
      const lesson = await lessonOf(ctx, courseId, lessonId);
      if (!(await canWatch(ctx, courseId))) fail(403, "not_enrolled", "請先領取這門課程");
      if (lesson.media_type === "youtube" && lesson.media_ref) return { kind: "youtube", videoId: lesson.media_ref };
      if (lesson.media_type === "mux" && lesson.media_ref) {
        const url = await muxPlaybackUrl(ctx.env, lesson.media_ref);
        if (!url) fail(503, "media_not_ready", "影片授權服務尚未設定，請稍後再試");
        return { kind: "hls", url };
      }
      return { kind: "demo", url: DEMO_VIDEO_PATH, label: "示範影片（非正式課程內容）" };
    },
  ],
  ["POST", /^\/orders$/, async (ctx) => createOrders(ctx, await readJson(ctx.req))],
  [
    "GET",
    /^\/orders$/,
    async (ctx) => {
      const s = requireMember(ctx);
      const { results } = await ctx.db.prepare(`${ORDER_SELECT} WHERE member_sub = ? ORDER BY created_at DESC LIMIT 100`).bind(s.sub).all<OrderRow>();
      return hydrateOrders(ctx.db, results);
    },
  ],
  [
    "GET",
    /^\/orders\/([\w-]+)$/,
    async (ctx, [id]) => {
      const s = requireMember(ctx);
      const row = await ctx.db.prepare(`${ORDER_SELECT} WHERE id = ? AND (member_sub = ? OR ? = 'admin')`).bind(id, s.sub, s.role).first<OrderRow>();
      if (!row) fail(404, "not_found", "找不到這筆訂單");
      return (await hydrateOrders(ctx.db, [row!]))[0];
    },
  ],
  [
    "GET",
    /^\/notifications$/,
    async (ctx) => {
      const s = requireMember(ctx);
      const { results } = await ctx.db
        .prepare(
          "SELECT id, title, body, link, read_at, created_at FROM notifications WHERE recipient_sub = ? OR (recipient_role = 'admin' AND ? = 'admin') ORDER BY created_at DESC LIMIT 100",
        )
        .bind(s.sub, s.role)
        .all<{ id: string; title: string; body: string; link: string; read_at: string | null; created_at: string }>();
      return results.map((n): Notice => ({ id: n.id, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at }));
    },
  ],
  [
    "POST",
    /^\/notifications\/read-all$/,
    async (ctx) => {
      const s = requireMember(ctx);
      await ctx.db
        .prepare("UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND (recipient_sub = ? OR (recipient_role = 'admin' AND ? = 'admin'))")
        .bind(iso(), s.sub, s.role)
        .run();
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/notifications\/([\w-]+)\/read$/,
    async (ctx, [id]) => {
      const s = requireMember(ctx);
      await ctx.db
        .prepare("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND (recipient_sub = ? OR (recipient_role = 'admin' AND ? = 'admin'))")
        .bind(iso(), id, s.sub, s.role)
        .run();
      return { ok: true };
    },
  ],
  [
    "GET",
    /^\/admin\/orders$/,
    async (ctx) => {
      requireAdmin(ctx);
      const status = ctx.url.searchParams.get("status");
      const filter = status === "pending" || status === "opened" || status === "rejected" ? status : null;
      const { results } = await ctx.db
        .prepare(`${ORDER_SELECT} WHERE total_twd > 0 AND (? IS NULL OR status = ?) ORDER BY created_at DESC LIMIT 200`)
        .bind(filter, filter)
        .all<OrderRow>();
      return hydrateOrders(ctx.db, results);
    },
  ],
  ["POST", /^\/admin\/orders\/([\w-]+)\/review$/, async (ctx, [id]) => reviewOrder(ctx, id, await readJson(ctx.req))],
  [
    "PATCH",
    /^\/admin\/lessons\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const body = await readJson<{ mediaType?: unknown; mediaRef?: unknown; minutes?: unknown }>(ctx.req);
      const minutes = body.minutes === undefined ? null : Number(body.minutes);
      if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 1000)) fail(400, "invalid_minutes", "影片長度不正確");
      const type = body.mediaType;
      const ref = typeof body.mediaRef === "string" ? body.mediaRef.trim() : "";
      if (type !== "demo" && type !== "youtube" && type !== "mux") fail(400, "invalid_media", "影片來源不正確");
      let mediaRef: string | null = null;
      if (type === "youtube") {
        mediaRef = youtubeId(ref) ?? fail(400, "invalid_youtube", "請貼上 YouTube 影片網址或 11 碼影片 ID");
      } else if (type === "mux") {
        if (!/^[A-Za-z0-9]{10,80}$/.test(ref)) fail(400, "invalid_mux", "請貼上 Mux Playback ID");
        mediaRef = ref;
      }
      const [res] = await ctx.db.batch([
        ctx.db
          .prepare("UPDATE lessons SET media_type = ?, media_ref = ?, duration_minutes = COALESCE(?, duration_minutes) WHERE id = ?")
          .bind(type, mediaRef, minutes, id),
        audit(ctx.db, admin.sub, "lesson.media", "lesson", id, String(type)),
      ]);
      if (res.meta?.changes === 0) fail(404, "not_found", "找不到這個章節");
      return { ok: true, mediaType: type, mediaRef };
    },
  ],
  [
    "GET",
    /^\/admin\/mux\/assets$/,
    async (ctx) => {
      requireAdmin(ctx);
      const cursor = ctx.url.searchParams.get("cursor") ?? undefined;
      if (cursor && !/^[\w-]{1,200}$/.test(cursor)) fail(400, "invalid_cursor", "分頁參數不正確");
      try {
        return await listMuxAssets(ctx.env, cursor);
      } catch (e) {
        if (!(e instanceof MuxApiError)) throw e;
        if (e.code === "mux_api_not_configured") return fail(503, e.code, "尚未設定 Mux API 存取權杖，無法讀取影片清單");
        if (e.code === "mux_api_unauthorized") return fail(503, e.code, "Mux API 存取權杖無效或權限不足");
        return fail(503, e.code, "Mux 暫時無法連線，請稍後再試");
      }
    },
  ],
  ["GET", /^\/admin\/courses$/, async (ctx) => (requireAdmin(ctx), listCourses(ctx, true))],
  [
    "PATCH",
    /^\/admin\/courses\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const body = await readJson<{ minRankCode?: unknown; status?: unknown }>(ctx.req);
      const rankMap = await ranks(ctx.db);
      const sets: string[] = [];
      const values: unknown[] = [];
      if (body.minRankCode !== undefined) {
        if (typeof body.minRankCode !== "string" || !rankMap.has(body.minRankCode)) fail(400, "invalid_rank", "獎銜不存在");
        sets.push("min_rank_code = ?");
        values.push(body.minRankCode);
      }
      if (body.status !== undefined) {
        if (body.status !== "draft" && body.status !== "published" && body.status !== "archived") fail(400, "invalid_status", "狀態不正確");
        sets.push("status = ?");
        values.push(body.status);
      }
      if (!sets.length) fail(400, "nothing_to_update", "沒有要更新的欄位");
      const [res] = await ctx.db.batch([
        ctx.db.prepare(`UPDATE courses SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).bind(...values, iso(), id),
        audit(ctx.db, admin.sub, "course.update", "course", id, JSON.stringify(body)),
      ]);
      if (res.meta?.changes === 0) fail(404, "not_found", "找不到這門課程");
      return courseDetail(ctx, id);
    },
  ],
];

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** 處理 /api/v2/*；其他路徑交給靜態網站。 */
export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  const cors: Record<string, string> =
    origin && LOCAL_ORIGIN.test(origin)
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "authorization, content-type, x-client-platform",
          "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
          vary: "origin",
        }
      : {};
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const path = url.pathname.replace(/^\/api\/v2/, "") || "/";
  let res: Response;
  try {
    const route = routes.find(([m, re]) => m === req.method && re.test(path));
    if (!route) {
      if (routes.some(([, re]) => re.test(path))) fail(405, "method_not_allowed", "不支援這個操作");
      fail(404, "not_found", "找不到這個 API");
    }
    const [, re, handler] = route!;
    res = json(await handler(await context(req, env, url), [...re.exec(path)!].slice(1)));
  } catch (e) {
    if (e instanceof HttpError) res = json({ error: { code: e.code, message: e.message } }, e.status);
    else {
      console.error("api error", e);
      res = json({ error: { code: "internal", message: "系統忙碌，請稍後再試" } }, 500);
    }
  }
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

async function context(req: Request, env: Env, url: URL): Promise<Ctx> {
  return { env, db: env.DB, req, url, platform: platformOf(req), session: await loadSession(env, req) };
}
