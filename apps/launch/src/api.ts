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
import { audioUrl, verifyAudioUrl } from "./media.ts";
import { checkMuxPlayback, listMuxAssets, MuxApiError, muxPlaybackUrl } from "./mux.ts";

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
    const [name, admin] = await Promise.all([displayName(sub, jwt), isAdmin(sub, jwt, env.LEARN_ADMIN_SUBS)]);
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
  description?: string;
  lesson_count: number;
  total_minutes: number;
};

const COURSE_SELECT = `SELECT c.id, c.title, c.subtitle, c.teacher, c.category, c.price_twd, c.min_rank_code, c.theme, c.status, c.description,
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
      .prepare("SELECT id, position, title, duration_minutes, media_type, media_ref, start_seconds, end_seconds FROM lessons WHERE course_id = ? ORDER BY position")
      .bind(id)
      .all<{ id: string; position: number; title: string; duration_minutes: number; media_type: MediaType; media_ref: string | null; start_seconds: number | null; end_seconds: number | null }>(),
    ctx.session
      ? ctx.db.prepare("SELECT lesson_id FROM lesson_progress WHERE member_sub = ? AND course_id = ?").bind(ctx.session.sub, id).all<{ lesson_id: string }>()
      : Promise.resolve({ results: [] as { lesson_id: string }[] }),
  ]);
  const completed = new Set(done.results.map((r) => r.lesson_id));
  return {
    ...summarize(row!, ctx, rankMap, state, await eligibilityFor(ctx.session, rankMap, [row!.min_rank_code])),
    description: row!.description ?? "",
    lessons: lessons.results.map((l) => ({
      id: l.id,
      position: l.position,
      title: l.title,
      minutes: l.duration_minutes,
      completed: completed.has(l.id),
      kind: l.media_type === "audio" ? ("audio" as const) : ("video" as const),
      start: l.start_seconds,
      end: l.end_seconds,
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
    .prepare("SELECT l.id, l.media_type, l.media_ref, l.start_seconds, l.end_seconds FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? AND l.course_id = ?")
    .bind(lessonId, courseId)
    .first<{ id: string; media_type: MediaType; media_ref: string | null; start_seconds: number | null; end_seconds: number | null }>();
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
  if (!ids.length || ids.length > 20) fail(400, "invalid_courses", "請選擇要報名的課程");
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
  if (courses.some((c) => eligibility.get(c.min_rank_code) !== true)) fail(403, "rank_required", "此課程需要符合資格才能報名");
  if (courses.some((c) => state.enrolled.has(c.id) || state.pending.has(c.id))) fail(409, "duplicate", "這門課程已報名（已開通或審核中），請勿重複報名");
  const free = courses.filter((c) => c.price_twd === 0);
  const paid = courses.filter((c) => c.price_twd > 0);
  if (paid.length && ctx.platform !== "web") fail(403, "web_only", "付費課程請至網頁版報名");

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
      notify(ctx.db, { sub: s.sub }, isFree ? "課程已開通" : "報名已送出，等待審核", titles, isFree ? "/learning" : `/orders/${id}`),
      audit(ctx.db, s.sub, isFree ? "order.claim_free" : "order.submit", "order", id, titles),
    );
    if (!isFree) statements.push(notify(ctx.db, { role: "admin" }, "有新的報名待審核", `${s.name} · NT$${total.toLocaleString("en-US")}`, `/admin/orders/${id}`));
  }
  try {
    await ctx.db.batch(statements);
  } catch {
    fail(409, "duplicate", "這門課程已經報名過了");
  }
  const { results } = await ctx.db.prepare(`${ORDER_SELECT} WHERE id IN (${created.map(() => "?").join(",")})`).bind(...created).all<OrderRow>();
  return hydrateOrders(ctx.db, results);
}

async function reviewOrder(ctx: Ctx, id: string, body: { approve?: unknown; reason?: unknown }): Promise<Order> {
  const admin = requireAdmin(ctx);
  if (ctx.platform !== "web") fail(403, "web_only", "報名審核請至網頁版辦理");
  const approve = body.approve === true;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!approve && !reason) fail(400, "reason_required", "請填寫未通過原因");
  const order = await ctx.db.prepare("SELECT id, member_sub, status FROM orders WHERE id = ?").bind(id).first<{ id: string; member_sub: string; status: string }>();
  if (!order) return fail(404, "not_found", "找不到這筆報名");
  if (order.status !== "pending") fail(409, "already_reviewed", "這筆報名已審核過");
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
      approve ? "繳費確認完成，課程已開通" : "報名審核未通過",
      approve ? "前往我的課程開始學習。" : reason,
      approve ? "/learning" : `/orders/${id}`,
    ),
    audit(ctx.db, admin.sub, approve ? "order.approve" : "order.reject", "order", id, reason),
  );
  const [update] = await ctx.db.batch(statements);
  if (update.meta?.changes === 0) fail(409, "already_reviewed", "這筆報名已審核過");
  const row = await ctx.db.prepare(`${ORDER_SELECT} WHERE id = ?`).bind(id).first<OrderRow>();
  return (await hydrateOrders(ctx.db, [row!]))[0];
}

type MediaType = "demo" | "youtube" | "mux" | "audio";

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

// ---------- admin: courses & lessons ----------

const THEMES = ["sage", "rose", "gold", "blue", "clay", "violet"];
function randomId(n: number): string {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => a[b % a.length]).join("");
}
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

async function courseFields(ctx: Ctx, body: Record<string, unknown>, creating: boolean) {
  const sets: [string, unknown][] = [];
  const t = text(body.title, 120);
  if (t !== undefined) {
    if (!t) fail(400, "title_required", "請輸入課程名稱");
    sets.push(["title", t]);
  } else if (creating) fail(400, "title_required", "請輸入課程名稱");
  for (const [k, col, max] of [["subtitle", "subtitle", 200], ["teacher", "teacher", 60], ["category", "category", 30], ["description", "description", 5000]] as const) {
    const v = text(body[k], max);
    if (v !== undefined) sets.push([col, v]);
  }
  if (body.priceTwd !== undefined) {
    const n = Number(body.priceTwd);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) fail(400, "invalid_price", "費用請輸入 0 以上的整數");
    sets.push(["price_twd", n]);
  }
  if (body.theme !== undefined) {
    if (!THEMES.includes(String(body.theme))) fail(400, "invalid_theme", "封面顏色不正確");
    sets.push(["theme", body.theme]);
  }
  if (body.minRankCode !== undefined) {
    if (typeof body.minRankCode !== "string" || !(await ranks(ctx.db)).has(body.minRankCode)) fail(400, "invalid_rank", "獎銜不存在");
    sets.push(["min_rank_code", body.minRankCode]);
  }
  if (body.status !== undefined) {
    if (body.status !== "draft" && body.status !== "published" && body.status !== "archived") fail(400, "invalid_status", "狀態不正確");
    sets.push(["status", body.status]);
  }
  return sets;
}

async function createCourse(ctx: Ctx, admin: Session) {
  const body = await readJson<Record<string, unknown>>(ctx.req);
  const sets = await courseFields(ctx, body, true);
  const id = `c${randomId(7)}`;
  const max = await ctx.db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM courses").first<{ m: number }>();
  const cols = ["id", "sort_order", "status", ...sets.map(([c]) => c).filter((c) => c !== "status")];
  const vals = [id, (max?.m ?? 0) + 1, sets.find(([c]) => c === "status")?.[1] ?? "draft", ...sets.filter(([c]) => c !== "status").map(([, v]) => v)];
  await ctx.db.batch([
    ctx.db.prepare(`INSERT INTO courses (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...vals),
    ctx.db.prepare("INSERT INTO lessons (id, course_id, position, title, duration_minutes, media_type) VALUES (?, ?, 1, '第 1 堂', 0, 'demo')").bind(`${id}-${randomId(6)}`, id),
    audit(ctx.db, admin.sub, "course.create", "course", id, String(body.title ?? "")),
  ]);
  return courseDetail(ctx, id);
}

async function updateCourse(ctx: Ctx, id: string, admin: Session) {
  const body = await readJson<Record<string, unknown>>(ctx.req);
  const sets = await courseFields(ctx, body, false);
  if (!sets.length) fail(400, "nothing_to_update", "沒有要更新的欄位");
  const [res] = await ctx.db.batch([
    ctx.db.prepare(`UPDATE courses SET ${sets.map(([c]) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).bind(...sets.map(([, v]) => v), iso(), id),
    audit(ctx.db, admin.sub, "course.update", "course", id, sets.map(([c]) => c).join(",")),
  ]);
  if (res.meta?.changes === 0) fail(404, "not_found", "找不到這門課程");
  return courseDetail(ctx, id);
}

async function renumber(db: D1Database, courseId: string) {
  const { results } = await db.prepare("SELECT id FROM lessons WHERE course_id = ? ORDER BY position").bind(courseId).all<{ id: string }>();
  await db.batch([
    db.prepare("UPDATE lessons SET position = -position WHERE course_id = ?").bind(courseId),
    ...results.map((r, i) => db.prepare("UPDATE lessons SET position = ? WHERE id = ?").bind(i + 1, r.id)),
  ]);
}

const seconds = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 24 * 3600) fail(400, "invalid_time", "時間格式不正確");
  return n;
};

/** 修改章節：名稱、影片來源（示範／YouTube／Mux）、時間軸區間。音檔由上傳流程設定。 */
async function updateLesson(ctx: Ctx, id: string, admin: Session) {
  const body = await readJson<{ title?: unknown; mediaType?: unknown; mediaRef?: unknown; minutes?: unknown; startSeconds?: unknown; endSeconds?: unknown }>(ctx.req);
  const cur = await ctx.db
    .prepare("SELECT media_type, media_ref, start_seconds, end_seconds FROM lessons WHERE id = ?")
    .bind(id)
    .first<{ media_type: MediaType; media_ref: string | null; start_seconds: number | null; end_seconds: number | null }>();
  if (!cur) return fail(404, "not_found", "找不到這個章節");
  const sets: [string, unknown][] = [];
  const title = text(body.title, 120);
  if (title !== undefined) {
    if (!title) fail(400, "title_required", "請輸入章節名稱");
    sets.push(["title", title]);
  }
  let type = cur.media_type;
  if (body.mediaType !== undefined) {
    const t = body.mediaType;
    const ref = typeof body.mediaRef === "string" ? body.mediaRef.trim() : "";
    if (t !== "demo" && t !== "youtube" && t !== "mux") fail(400, "invalid_media", "影片來源不正確");
    let mediaRef: string | null = null;
    if (t === "youtube") mediaRef = youtubeId(ref) ?? fail(400, "invalid_youtube", "請貼上 YouTube 影片網址或 11 碼影片 ID");
    else if (t === "mux") {
      if (!/^[A-Za-z0-9]{10,80}$/.test(ref)) fail(400, "invalid_mux", "請從 Mux 選擇影片");
      mediaRef = ref;
    }
    type = t as MediaType;
    sets.push(["media_type", t], ["media_ref", mediaRef]);
  }
  const start = seconds(body.startSeconds);
  const end = seconds(body.endSeconds);
  const finalStart = start === undefined ? cur.start_seconds : start;
  const finalEnd = end === undefined ? cur.end_seconds : end;
  if (finalStart != null && finalEnd != null && finalEnd <= finalStart) fail(400, "invalid_range", "結束時間必須晚於開始時間");
  if (start !== undefined) sets.push(["start_seconds", start]);
  if (end !== undefined) sets.push(["end_seconds", end]);
  const minutes = body.minutes === undefined ? undefined : Number(body.minutes);
  if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 0 || minutes > 1000)) fail(400, "invalid_minutes", "影片長度不正確");
  // 有設定區間時，章節長度＝區間長度（分鐘，無條件進位）。
  if (finalEnd != null && (start !== undefined || end !== undefined)) sets.push(["duration_minutes", Math.max(1, Math.ceil((finalEnd - (finalStart ?? 0)) / 60))]);
  else if (minutes !== undefined) sets.push(["duration_minutes", minutes]);
  if (!sets.length) fail(400, "nothing_to_update", "沒有要更新的欄位");
  await ctx.db.batch([
    ctx.db.prepare(`UPDATE lessons SET ${sets.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`).bind(...sets.map(([, v]) => v), id),
    audit(ctx.db, admin.sub, "lesson.update", "lesson", id, sets.map(([c]) => c).join(",")),
  ]);
  if (cur.media_type === "audio" && type !== "audio" && cur.media_ref) await ctx.env.MEDIA?.delete(cur.media_ref).catch(() => undefined);
  const row = await ctx.db.prepare("SELECT media_type, media_ref FROM lessons WHERE id = ?").bind(id).first<{ media_type: string; media_ref: string | null }>();
  return { ok: true, mediaType: row?.media_type, mediaRef: row?.media_ref };
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
      if (!(await canWatch(ctx, courseId))) fail(403, "not_enrolled", "請先報名並通過審核");
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
      if (!(await canWatch(ctx, courseId))) fail(403, "not_enrolled", "請先報名並通過審核");
      const seg = { start: lesson.start_seconds, end: lesson.end_seconds };
      if (lesson.media_type === "youtube" && lesson.media_ref) return { kind: "youtube", videoId: lesson.media_ref, ...seg };
      if (lesson.media_type === "mux" && lesson.media_ref) {
        const url = await muxPlaybackUrl(ctx.env, lesson.media_ref);
        if (!url) fail(503, "media_not_ready", "影片授權服務尚未設定，請稍後再試");
        return { kind: "hls", url, ...seg };
      }
      if (lesson.media_type === "audio" && lesson.media_ref) {
        const url = await audioUrl(ctx.env, lesson.media_ref);
        if (!url) fail(503, "media_not_ready", "音檔服務尚未設定，請稍後再試");
        return { kind: "audio", url, ...seg };
      }
      return { kind: "demo", url: DEMO_VIDEO_PATH, label: "示範影片（非正式課程內容）", ...seg };
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
      if (!row) fail(404, "not_found", "找不到這筆報名");
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
    async (ctx, [id]) => updateLesson(ctx, id, requireAdmin(ctx)),
  ],
  [
    "DELETE",
    /^\/admin\/lessons\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const lesson = await ctx.db.prepare("SELECT course_id, media_type, media_ref FROM lessons WHERE id = ?").bind(id).first<{ course_id: string; media_type: string; media_ref: string | null }>();
      if (!lesson) return fail(404, "not_found", "找不到這個章節");
      await ctx.db.batch([ctx.db.prepare("DELETE FROM lessons WHERE id = ?").bind(id), audit(ctx.db, admin.sub, "lesson.delete", "lesson", id)]);
      await renumber(ctx.db, lesson.course_id);
      if (lesson.media_type === "audio" && lesson.media_ref) await ctx.env.MEDIA?.delete(lesson.media_ref).catch(() => undefined);
      return { ok: true };
    },
  ],
  [
    "GET",
    /^\/admin\/lessons\/([\w-]+)\/check$/,
    async (ctx, [id]) => {
      requireAdmin(ctx);
      const l = await ctx.db.prepare("SELECT media_type, media_ref FROM lessons WHERE id = ?").bind(id).first<{ media_type: string; media_ref: string | null }>();
      if (!l) return fail(404, "not_found", "找不到這個章節");
      if (l.media_type === "mux" && l.media_ref) return checkMuxPlayback(ctx.env, l.media_ref);
      if (l.media_type === "audio" && l.media_ref) {
        const head = await ctx.env.MEDIA?.head(l.media_ref);
        return head ? { ok: true, message: `音檔正常（${Math.round(head.size / 1024 / 1024)} MB）` } : { ok: false, message: "找不到音檔，請重新上傳" };
      }
      return { ok: true, message: "這個來源不需要檢查" };
    },
  ],
  [
    "POST",
    /^\/admin\/lessons\/([\w-]+)\/audio\/start$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const bucket = ctx.env.MEDIA ?? fail(503, "storage_not_ready", "音檔儲存空間尚未啟用");
      const body = await readJson<{ fileName?: unknown; contentType?: unknown; size?: unknown }>(ctx.req);
      const type = typeof body.contentType === "string" ? body.contentType : "";
      if (!/^audio\/[\w.+-]+$/.test(type)) fail(400, "invalid_audio", "請選擇音訊檔（例如 MP3、M4A）");
      if (typeof body.size !== "number" || body.size <= 0 || body.size > 2 * 1024 ** 3) fail(400, "invalid_size", "音檔大小需小於 2GB");
      if (!(await ctx.db.prepare("SELECT 1 AS ok FROM lessons WHERE id = ?").bind(id).first())) fail(404, "not_found", "找不到這個章節");
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(String(body.fileName ?? ""))?.[1] ?? "audio").toLowerCase();
      const key = `audio/${id}/${crypto.randomUUID()}.${ext}`;
      const upload = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: type } });
      await audit(ctx.db, admin.sub, "lesson.audio_upload_start", "lesson", id, key).run();
      return { key, uploadId: upload.uploadId };
    },
  ],
  [
    "PUT",
    /^\/admin\/lessons\/([\w-]+)\/audio\/part$/,
    async (ctx, [id]) => {
      requireAdmin(ctx);
      const bucket = ctx.env.MEDIA ?? fail(503, "storage_not_ready", "音檔儲存空間尚未啟用");
      const key = ctx.url.searchParams.get("key") ?? "";
      const uploadId = ctx.url.searchParams.get("uploadId") ?? "";
      const part = Number(ctx.url.searchParams.get("part"));
      if (!key.startsWith(`audio/${id}/`) || !uploadId || !Number.isInteger(part) || part < 1 || part > 10000) fail(400, "invalid_part", "上傳參數不正確");
      const uploaded = await bucket.resumeMultipartUpload(key, uploadId).uploadPart(part, await ctx.req.arrayBuffer());
      return { partNumber: uploaded.partNumber, etag: uploaded.etag };
    },
  ],
  [
    "POST",
    /^\/admin\/lessons\/([\w-]+)\/audio\/complete$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const bucket = ctx.env.MEDIA ?? fail(503, "storage_not_ready", "音檔儲存空間尚未啟用");
      const body = await readJson<{ key?: unknown; uploadId?: unknown; parts?: unknown; durationSeconds?: unknown }>(ctx.req);
      const key = typeof body.key === "string" ? body.key : "";
      if (!key.startsWith(`audio/${id}/`) || typeof body.uploadId !== "string" || !Array.isArray(body.parts) || !body.parts.length) fail(400, "invalid_upload", "上傳參數不正確");
      const parts = (body.parts as { partNumber: number; etag: string }[]).map((x) => ({ partNumber: Number(x.partNumber), etag: String(x.etag) }));
      await bucket.resumeMultipartUpload(key, body.uploadId as string).complete(parts);
      const old = await ctx.db.prepare("SELECT media_type, media_ref FROM lessons WHERE id = ?").bind(id).first<{ media_type: string; media_ref: string | null }>();
      const seconds = typeof body.durationSeconds === "number" && body.durationSeconds > 0 ? body.durationSeconds : null;
      await ctx.db.batch([
        ctx.db
          .prepare("UPDATE lessons SET media_type = 'audio', media_ref = ?, start_seconds = NULL, end_seconds = NULL, duration_minutes = COALESCE(?, duration_minutes) WHERE id = ?")
          .bind(key, seconds ? Math.max(1, Math.ceil(seconds / 60)) : null, id),
        audit(ctx.db, admin.sub, "lesson.audio_uploaded", "lesson", id, key),
      ]);
      if (old?.media_type === "audio" && old.media_ref && old.media_ref !== key) await bucket.delete(old.media_ref).catch(() => undefined);
      return { ok: true, key };
    },
  ],
  [
    "GET",
    /^\/media\/audio$/,
    async (ctx) => {
      // 以短效簽名網址授權（播放器無法帶 Authorization 標頭），支援 Range 以便拖曳進度。
      const key = await verifyAudioUrl(ctx.env, ctx.url);
      const bucket = ctx.env.MEDIA;
      if (!key || !bucket) return new Response("Forbidden", { status: 403 });
      const range = /^bytes=(\d*)-(\d*)$/.exec(ctx.req.headers.get("range") ?? "");
      const head = await bucket.head(key);
      if (!head) return new Response("Not found", { status: 404 });
      const size = head.size;
      let start = 0;
      let end = size - 1;
      if (range && (range[1] || range[2])) {
        start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
      }
      const obj = await bucket.get(key, { range: { offset: start, length: end - start + 1 } });
      if (!obj) return new Response("Not found", { status: 404 });
      const headers = new Headers({
        "content-type": head.httpMetadata?.contentType ?? "audio/mpeg",
        "accept-ranges": "bytes",
        "content-length": String(end - start + 1),
        "cache-control": "private, max-age=3600",
      });
      if (range && (range[1] || range[2])) headers.set("content-range", `bytes ${start}-${end}/${size}`);
      return new Response(obj.body, { status: range && (range[1] || range[2]) ? 206 : 200, headers });
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
  ["POST", /^\/admin\/courses$/, async (ctx) => createCourse(ctx, requireAdmin(ctx))],
  ["PATCH", /^\/admin\/courses\/([\w-]+)$/, async (ctx, [id]) => updateCourse(ctx, id, requireAdmin(ctx))],
  [
    "DELETE",
    /^\/admin\/courses\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const used = await ctx.db
        .prepare("SELECT (SELECT COUNT(*) FROM order_items WHERE course_id = ?) + (SELECT COUNT(*) FROM enrollments WHERE course_id = ?) AS n")
        .bind(id, id)
        .first<{ n: number }>();
      if ((used?.n ?? 0) > 0) fail(409, "in_use", "這門課程已有學員報名，不能刪除；請改用「下架」");
      const audio = await ctx.db.prepare("SELECT media_ref FROM lessons WHERE course_id = ? AND media_type = 'audio' AND media_ref IS NOT NULL").bind(id).all<{ media_ref: string }>();
      const [res] = await ctx.db.batch([ctx.db.prepare("DELETE FROM courses WHERE id = ?").bind(id), audit(ctx.db, admin.sub, "course.delete", "course", id)]);
      if (res.meta?.changes === 0) fail(404, "not_found", "找不到這門課程");
      for (const a of audio.results) await ctx.env.MEDIA?.delete(a.media_ref).catch(() => undefined);
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/admin\/courses\/([\w-]+)\/lessons$/,
    async (ctx, [courseId]) => {
      const admin = requireAdmin(ctx);
      const body = await readJson<{ title?: unknown }>(ctx.req);
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
      if (!title) fail(400, "title_required", "請輸入章節名稱");
      const course = await ctx.db.prepare("SELECT (SELECT COALESCE(MAX(position), 0) FROM lessons WHERE course_id = c.id) AS maxpos FROM courses c WHERE c.id = ?").bind(courseId).first<{ maxpos: number }>();
      if (!course) return fail(404, "not_found", "找不到這門課程");
      const id = `${courseId}-${randomId(6)}`;
      await ctx.db.batch([
        ctx.db.prepare("INSERT INTO lessons (id, course_id, position, title, duration_minutes, media_type) VALUES (?, ?, ?, ?, 0, 'demo')").bind(id, courseId, course.maxpos + 1, title),
        audit(ctx.db, admin.sub, "lesson.create", "lesson", id, title),
      ]);
      return courseDetail(ctx, courseId);
    },
  ],
  [
    "POST",
    /^\/admin\/courses\/([\w-]+)\/lessons\/order$/,
    async (ctx, [courseId]) => {
      const admin = requireAdmin(ctx);
      const body = await readJson<{ ids?: unknown }>(ctx.req);
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
      const current = await ctx.db.prepare("SELECT id FROM lessons WHERE course_id = ?").bind(courseId).all<{ id: string }>();
      const set = new Set(current.results.map((r) => r.id));
      if (ids.length !== set.size || new Set(ids).size !== ids.length || ids.some((i) => !set.has(i))) fail(400, "invalid_order", "章節順序不正確，請重新整理後再試");
      // 先移到負數避開 UNIQUE(course_id, position)，再寫入新順序。
      await ctx.db.batch([
        ctx.db.prepare("UPDATE lessons SET position = -position WHERE course_id = ?").bind(courseId),
        ...ids.map((id, i) => ctx.db.prepare("UPDATE lessons SET position = ? WHERE id = ?").bind(i + 1, id)),
        audit(ctx.db, admin.sub, "lesson.reorder", "course", courseId),
      ]);
      return courseDetail(ctx, courseId);
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
          "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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
    const out = await handler(await context(req, env, url), [...re.exec(path)!].slice(1));
    res = out instanceof Response ? out : json(out);
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
