import {
  DEMO_MEMBERS,
  HQ_UNIT,
  REVIEW_REASONS,
  type CourseComment,
  type Duty,
  type OrderEvent,
  type ReviewAction,
  type ReviewGroup,
  type ReviewReason,
  type ClientPlatform,
  type CourseDetail,
  type CourseSummary,
  type Member,
  type Attachment,
  type AttachmentType,
  type CourseDeleteImpact,
  type CoverBackground,
  type RunDeleteImpact,
  type Notice,
  type NotificationSettings,
  type Order,
  type Rank,
} from "./contract.ts";
import { flushEmails } from "./email.ts";
import { centerKey, centerList, contactEmail, displayName, saveContactEmail, validEmail, isAdmin, looksLikeJwt, memberContext, rankEligibility, verifyAccessToken } from "./central.ts";
import type { D1Database, D1PreparedStatement, Env } from "./d1.ts";
import { LINK_DEFAULT_TITLE, classifyLink, parseHttpsUrl } from "./links.ts";
import { audioUrl, fileUrl, imgUrl, sniffImage, verifyAudioUrl, verifyFileUrl, verifyImgUrl } from "./media.ts";
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
type SessionBase = { sub: string; name: string; role: "student" | "admin"; roles: string[]; hglobal: boolean; center: { key: string; label: string } | null };
type Session = SessionBase & ({ kind: "demo"; rankCode: string } | { kind: "central"; token: string });
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
    const [name, superAdmin, mc] = await Promise.all([displayName(sub, jwt), isAdmin(sub, jwt, env.LEARN_ADMIN_SUBS), memberContext(sub, jwt)]);
    // 管理員（可管理課程、審核全部報名）＝超級管理員、總部秘書，或 LEARN_ADMIN_SUBS 指定的會員。
    const admin = superAdmin || mc.roles.includes("super_admin") || mc.roles.includes("secretary");
    return { kind: "central", sub, name, role: admin ? "admin" : "student", token: jwt, roles: mc.roles, hglobal: mc.hglobal, center: mc.center };
  }
  if (!demoEnabled(env)) return null;
  const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(auth);
  if (!m) return null;
  const row = await db
    .prepare("SELECT member_sub, display_name, rank_code, role FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await sha256(m[1]), iso())
    .first<{ member_sub: string; display_name: string; rank_code: string; role: "student" | "admin" }>();
  if (!row) return null;
  const d = DEMO_MEMBERS.find((x) => x.sub === row.member_sub);
  return {
    kind: "demo",
    sub: row.member_sub,
    name: row.display_name,
    rankCode: row.rank_code,
    role: row.role,
    roles: d?.roles ?? [],
    hglobal: d?.hglobal ?? false,
    center: d?.center ? { key: centerKey(d.center), label: d.center } : null,
  };
}

async function ranks(db: D1Database): Promise<Map<string, Rank>> {
  const { results } = await db.prepare("SELECT code, name, sort_order FROM ranks ORDER BY sort_order").all<{
    code: string;
    name: string;
    sort_order: number;
  }>();
  return new Map(results.map((r) => [r.code, { code: r.code, name: r.name, order: r.sort_order }]));
}

const ROLE_TITLES: Record<string, string> = { super_admin: "超級管理員", secretary: "總部秘書", president: "會長", sound: "音控", course: "課務", reviewer: "審核員" };
function memberOf(s: Session, rankMap: Map<string, Rank>, extra: { duties?: string[] } = {}): Member {
  const titles = [...s.roles.map((r) => ROLE_TITLES[r]).filter(Boolean), ...(extra.duties ?? [])];
  const base = { sub: s.sub, name: s.name, role: s.role, titles: [...new Set(titles)], reviewer: s.role === "admin" || s.roles.includes("president") || !!extra.duties?.length, center: s.center?.label ?? null };
  // 中央會員的獎銜屬 Amway 資料，App 不取得也不顯示；只有模擬會員帶示範獎銜。
  if (s.kind === "central") return { ...base, rank: null, demo: false };
  return { ...base, rank: rankMap.get(s.rankCode) ?? null, demo: true };
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

function notify(db: D1Database, to: { sub: string } | { role: "admin" } | { role: "president"; centerKey: string }, title: string, body: string, link: string): D1PreparedStatement {
  return db
    .prepare("INSERT INTO notifications (id, recipient_sub, recipient_role, recipient_center_key, title, body, link) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), "sub" in to ? to.sub : null, "role" in to ? to.role : null, "centerKey" in to ? to.centerKey : null, title, body, link);
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
  guidance_unit: string;
  host_unit: string;
  host_center_key: string | null;
  free_from: string | null;
  free_until: string | null;
  review_group_id: string | null;
  allow_president: number;
  edm_key: string | null;
  cover_key: string | null;
  cover_bg_id: string | null;
  art_version: number;
  run_count: number;
  lesson_count: number;
  total_minutes: number;
};

const COURSE_SELECT = `SELECT c.id, c.title, c.subtitle, c.teacher, c.category, c.price_twd, c.min_rank_code, c.theme, c.status, c.description, c.guidance_unit, c.host_unit, c.host_center_key, c.free_from, c.free_until, c.review_group_id, c.allow_president, c.edm_key, c.cover_key, c.cover_bg_id, c.art_version,
  (SELECT COUNT(*) FROM course_runs r WHERE r.course_id = c.id) AS run_count,
  (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
  (SELECT COALESCE(SUM(duration_minutes), 0) FROM lessons l WHERE l.course_id = c.id) AS total_minutes
  FROM courses c`;

type RunRow = {
  id: string;
  course_id: string;
  title: string;
  starts_at: string | null;
  location: string;
  register_until: string | null;
  capacity: number | null;
  price_twd: number | null;
  status: "open" | "closed";
};

async function memberCourseState(db: D1Database, sub: string | undefined) {
  const empty = { enrolled: new Set<string>(), pending: new Set<string>(), done: new Map<string, number>() };
  if (!sub) return empty;
  const [e, p, d] = await db.batch([
    db.prepare("SELECT course_id, run_id FROM enrollments WHERE member_sub = ?").bind(sub),
    db.prepare("SELECT DISTINCT i.course_id, i.run_id FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.member_sub = ? AND o.status = 'pending'").bind(sub),
    db.prepare("SELECT course_id, COUNT(*) AS n FROM lesson_progress WHERE member_sub = ? GROUP BY course_id").bind(sub),
  ]);
  // 鍵值：課程 ID（任何一場）與「課程 ID|場次 ID」。
  const keys = (rows: unknown[]) => new Set((rows as { course_id: string; run_id: string }[]).flatMap((r) => [r.course_id, `${r.course_id}|${r.run_id}`]));
  return { enrolled: keys(e.results), pending: keys(p.results), done: new Map((d.results as { course_id: string; n: number }[]).map((r) => [r.course_id, r.n])) };
}
type MemberState = Awaited<ReturnType<typeof memberCourseState>>;

/** 「會長也可報名」：課程開啟此條件時，會長不受獎銜限制。 */
const byPresident = (s: Session | null, c: { allow_president: number }) => c.allow_president === 1 && !!s?.roles.includes("president");

const inFreeWindow = (row: { free_from: string | null; free_until: string | null }, now = iso()) =>
  !!(row.free_from || row.free_until) && (!row.free_from || row.free_from <= now) && (!row.free_until || now < row.free_until);

function summarize(row: CourseRow, ctx: Ctx, rankMap: Map<string, Rank>, state: MemberState, eligibility: Map<string, boolean>): CourseSummary {
  const minRank = rankMap.get(row.min_rank_code) ?? { code: row.min_rank_code, name: row.min_rank_code, order: 9999 };
  const freeNow = row.price_twd > 0 && inFreeWindow(row);
  const price = freeNow ? 0 : row.price_twd;
  const web = ctx.platform === "web";
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    teacher: row.teacher,
    category: row.category,
    priceTwd: web ? price : null,
    originalPriceTwd: web ? row.price_twd : null,
    free: price === 0,
    freeNow,
    freeUntil: freeNow ? row.free_until : null,
    minRank,
    theme: row.theme,
    coverUrl: row.cover_key ? pubUrl(row.cover_key, row.art_version) : null,
    edmUrl: row.edm_key ? pubUrl(row.edm_key, row.art_version) : null,
    status: row.status,
    guidanceUnit: row.guidance_unit,
    hostUnit: row.host_unit,
    hasRuns: row.run_count > 0,
    lessonCount: row.lesson_count,
    totalMinutes: row.total_minutes,
    eligible: eligibility.get(row.min_rank_code) === true || byPresident(ctx.session, row),
    allowPresident: row.allow_president === 1,
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

async function runUsage(db: D1Database, courseId: string): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      "SELECT i.run_id, COUNT(*) AS n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.course_id = ? AND i.run_id <> '' AND o.status IN ('pending', 'opened') GROUP BY i.run_id",
    )
    .bind(courseId)
    .all<{ run_id: string; n: number }>();
  return new Map(results.map((r) => [r.run_id, r.n]));
}

function runOpen(r: RunRow, used: number, now = iso()): boolean {
  return r.status === "open" && (!r.register_until || now < r.register_until) && (r.capacity == null || used < r.capacity);
}

/** 課程介紹頁：需登入（未登入只能看課程清單）。 */
async function courseDetail(ctx: Ctx, id: string): Promise<CourseDetail> {
  const s = requireMember(ctx);
  const row = await ctx.db.prepare(`${COURSE_SELECT} WHERE c.id = ?`).bind(id).first<CourseRow>();
  if (!row || (row.status !== "published" && s.role !== "admin")) return fail(404, "not_found", "找不到這門課程");
  const [rankMap, state, lessons, done, runs, usage] = await Promise.all([
    ranks(ctx.db),
    memberCourseState(ctx.db, s.sub),
    ctx.db
      .prepare("SELECT id, position, title, duration_minutes, media_type, media_ref, start_seconds, end_seconds, run_id FROM lessons WHERE course_id = ? ORDER BY position")
      .bind(id)
      .all<{ id: string; position: number; title: string; duration_minutes: number; media_type: MediaType; media_ref: string | null; start_seconds: number | null; end_seconds: number | null; run_id: string | null }>(),
    ctx.db.prepare("SELECT lesson_id FROM lesson_progress WHERE member_sub = ? AND course_id = ?").bind(s.sub, id).all<{ lesson_id: string }>(),
    ctx.db.prepare("SELECT * FROM course_runs WHERE course_id = ? ORDER BY COALESCE(starts_at, created_at) DESC").bind(id).all<RunRow>(),
    runUsage(ctx.db, id),
  ]);
  const completed = new Set(done.results.map((r) => r.lesson_id));
  const freeNow = row.price_twd > 0 && inFreeWindow(row);
  const web = ctx.platform === "web";
  const admin = s.role === "admin";
  return {
    ...summarize(row, ctx, rankMap, state, await eligibilityFor(s, rankMap, [row.min_rank_code])),
    description: row.description ?? "",
    runs: runs.results.map((r) => {
      const price = freeNow ? 0 : (r.price_twd ?? row.price_twd);
      const used = usage.get(r.id) ?? 0;
      const key = `${id}|${r.id}`;
      return {
        id: r.id,
        title: r.title,
        startsAt: r.starts_at,
        location: r.location,
        registerUntil: r.register_until,
        capacity: r.capacity,
        remaining: r.capacity == null ? null : Math.max(0, r.capacity - used),
        priceTwd: web ? price : null,
        free: price === 0,
        status: r.status,
        open: runOpen(r, used),
        enrollment: state.enrolled.has(key) ? "opened" : state.pending.has(key) ? "pending" : null,
      };
    }),
    lessons: lessons.results.map((l) => ({
      id: l.id,
      position: l.position,
      title: l.title,
      minutes: l.duration_minutes,
      completed: completed.has(l.id),
      kind: l.media_type === "audio" ? ("audio" as const) : ("video" as const),
      start: l.start_seconds,
      end: l.end_seconds,
      runId: l.run_id,
      locked: !admin && !(l.run_id ? state.enrolled.has(`${id}|${l.run_id}`) : state.enrolled.has(id)),
      // 影片來源只給管理員（編輯用）；學員一律透過 playback API 取得授權後的播放資訊。
      ...(admin ? { media: { type: l.media_type, ref: l.media_ref } } : {}),
    })),
    ...(admin ? { admin: { coverBgId: row.cover_bg_id, hostCenterKey: row.host_center_key, freeFrom: row.free_from, freeUntil: row.free_until, reviewGroupId: row.review_group_id, basePriceTwd: row.price_twd } } : {}),
  };
}

/** 能否觀看：管理員可預覽；章節屬於某場次時需報名該場，否則報名該課程任一場即可。 */
async function canWatch(ctx: Ctx, courseId: string, runId: string | null): Promise<boolean> {
  const s = requireMember(ctx);
  if (s.role === "admin") return true;
  const row = runId
    ? await ctx.db.prepare("SELECT 1 AS ok FROM enrollments WHERE member_sub = ? AND course_id = ? AND run_id = ?").bind(s.sub, courseId, runId).first()
    : await ctx.db.prepare("SELECT 1 AS ok FROM enrollments WHERE member_sub = ? AND course_id = ? LIMIT 1").bind(s.sub, courseId).first();
  return !!row;
}

/** 刪除課程前的影響：多少筆報名紀錄、多少人已開通、已確認收款多少（供「輸入 YES」確認畫面顯示）。 */
async function courseDeleteImpact(db: D1Database, id: string): Promise<CourseDeleteImpact> {
  const c = await db.prepare("SELECT title FROM courses WHERE id = ?").bind(id).first<{ title: string }>();
  if (!c) return fail(404, "not_found", "找不到這門課程");
  const r = await db
    .prepare(
      `SELECT COUNT(DISTINCT i.order_id) AS registrations,
              COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) AS pending,
              COUNT(DISTINCT CASE WHEN o.status = 'opened' THEN o.id END) AS opened,
              COALESCE(SUM(CASE WHEN o.status = 'opened' THEN i.price_twd ELSE 0 END), 0) AS paid
       FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.course_id = ?`,
    )
    .bind(id)
    .first<{ registrations: number; pending: number; opened: number; paid: number }>();
  const [students, comments] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT member_sub) AS n FROM enrollments WHERE course_id = ?").bind(id).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM course_comments WHERE course_id = ?").bind(id).first<{ n: number }>(),
  ]);
  return { title: c.title, registrations: r?.registrations ?? 0, pending: r?.pending ?? 0, opened: r?.opened ?? 0, students: students?.n ?? 0, comments: comments?.n ?? 0, paidTwd: r?.paid ?? 0 };
}

/** 刪除場次前的影響統計（有報名紀錄時，畫面要求輸入 YES）。 */
async function runDeleteImpact(db: D1Database, id: string): Promise<RunDeleteImpact> {
  const run = await db.prepare("SELECT r.title, c.title AS course_title FROM course_runs r JOIN courses c ON c.id = r.course_id WHERE r.id = ?").bind(id).first<{ title: string; course_title: string }>();
  if (!run) return fail(404, "not_found", "找不到這個場次");
  const r = await db
    .prepare(
      `SELECT COUNT(DISTINCT i.order_id) AS registrations,
              COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) AS pending,
              COUNT(DISTINCT CASE WHEN o.status = 'opened' THEN o.id END) AS opened,
              COALESCE(SUM(CASE WHEN o.status = 'opened' THEN i.price_twd ELSE 0 END), 0) AS paid
       FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.run_id = ?`,
    )
    .bind(id)
    .first<{ registrations: number; pending: number; opened: number; paid: number }>();
  const [students, lessons] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT member_sub) AS n FROM enrollments WHERE run_id = ?").bind(id).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM lessons WHERE run_id = ?").bind(id).first<{ n: number }>(),
  ]);
  return { title: run.title, courseTitle: run.course_title, registrations: r?.registrations ?? 0, pending: r?.pending ?? 0, opened: r?.opened ?? 0, students: students?.n ?? 0, lessons: lessons?.n ?? 0, paidTwd: r?.paid ?? 0 };
}

/** 公開圖片（封面、EDM）的網址；版本號讓更新後瀏覽器改抓新圖。 */
const pubUrl = (key: string, v: number) => `/api/v2/media/pub?k=${encodeURIComponent(key)}&v=${v}`;
const ART_TYPES = new Set(["president", "sound"]);

/** 有課程編輯權限（可使用封面底圖圖庫）：超級管理員、總部秘書，以及各中心的會長、音控。 */
function canUseGallery(s: Session): boolean {
  return s.role === "admin" || (!!s.center && s.roles.some((r) => ART_TYPES.has(r)));
}

/** 編輯某門課的 EDM／封面：管理員（超級管理員、總部秘書）不限；其他有權限者只能編輯主辦單位是自己中心的課程。 */
async function requireCourseArt(ctx: Ctx, s: Session, courseId: string): Promise<void> {
  const c = await ctx.db.prepare("SELECT host_center_key FROM courses WHERE id = ?").bind(courseId).first<{ host_center_key: string | null }>();
  if (!c) return fail(404, "not_found", "找不到這門課程");
  if (s.role === "admin") return;
  if (!s.center || !s.roles.some((r) => ART_TYPES.has(r)) || c.host_center_key !== s.center.key) fail(403, "forbidden", "只能編輯主辦單位是自己中心的課程");
}

const ATTACH_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const ATTACH_KIND: Record<string, AttachmentType> = { pdf: "pdf", doc: "word", docx: "word", ppt: "ppt", pptx: "ppt", xls: "excel", xlsx: "excel", csv: "excel", txt: "text", zip: "zip", png: "image", jpg: "image", jpeg: "image" };
type AttachmentRow = { id: string; name: string; size: number; r2_key: string | null; kind: "file" | "link"; link_url: string | null; att_type: AttachmentType };
const ATTACH_COLS = "id, name, size, r2_key, kind, link_url, att_type";
async function attachmentOut(env: Env, r: AttachmentRow, withUrl: boolean): Promise<Attachment> {
  const url = r.kind === "link" ? (r.link_url ?? undefined) : withUrl && r.r2_key ? ((await fileUrl(env, r.r2_key)) ?? undefined) : undefined;
  return { id: r.id, name: r.name, kind: r.kind, type: r.att_type, size: r.size, url };
}
const cleanTitle = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80) : "");
const ATTACH_MAX = 50 * 1024 * 1024;
const ATTACH_PER_LESSON = 20;

/** 刪除章節／課程時一併清掉附件檔（資料列由 ON DELETE CASCADE 處理，須在刪資料前先取出鍵）。 */
async function attachmentKeys(db: D1Database, where: "lesson_id" | "course_id", id: string): Promise<string[]> {
  const { results } = await db.prepare(`SELECT r2_key FROM lesson_attachments WHERE r2_key IS NOT NULL AND ${where} = ?`).bind(id).all<{ r2_key: string }>();
  return results.map((r) => r.r2_key);
}

async function lessonOf(ctx: Ctx, courseId: string, lessonId: string) {
  const lesson = await ctx.db
    .prepare("SELECT l.id, l.media_type, l.media_ref, l.start_seconds, l.end_seconds, l.run_id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ? AND l.course_id = ?")
    .bind(lessonId, courseId)
    .first<{ id: string; media_type: MediaType; media_ref: string | null; start_seconds: number | null; end_seconds: number | null; run_id: string | null }>();
  return lesson ?? fail(404, "not_found", "找不到這個章節");
}

// ---------- 報名與審核 ----------

type OrderRow = {
  id: string;
  member_sub: string;
  status: Order["status"];
  total_twd: number;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  member_name_snapshot: string;
  center_key: string | null;
  center_label: string;
  hglobal: number;
  deferred: number;
  paid_twd: number | null;
  pay_method: Order["payMethod"];
  revoked_at: string | null;
};
const ORDER_SELECT = "SELECT o.id, o.member_sub, o.status, o.total_twd, o.reject_reason, o.created_at, o.reviewed_at, o.member_name_snapshot, o.center_key, o.center_label, o.hglobal, o.deferred, o.paid_twd, o.pay_method, o.revoked_at FROM orders o";

async function hydrateOrders(db: D1Database, rows: OrderRow[]): Promise<Order[]> {
  if (!rows.length) return [];
  const { results } = await db
    .prepare(`SELECT order_id, course_id, run_id, title_snapshot, price_twd FROM order_items WHERE order_id IN (${rows.map(() => "?").join(",")})`)
    .bind(...rows.map((r) => r.id))
    .all<{ order_id: string; course_id: string; run_id: string; title_snapshot: string; price_twd: number }>();
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    deferred: r.status === "pending" && r.deferred === 1,
    revoked: !!r.revoked_at,
    totalTwd: r.total_twd,
    paidTwd: r.paid_twd,
    payMethod: r.pay_method,
    rejectReason: r.reject_reason,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
    memberName: r.member_name_snapshot,
    centerLabel: r.center_label,
    hglobal: r.hglobal === 1,
    items: results.filter((i) => i.order_id === r.id).map((i) => ({ courseId: i.course_id, runId: i.run_id || null, title: i.title_snapshot, priceTwd: i.price_twd })),
  }));
}

/** 這位登入者的審核範圍：all＝全站（超級管理員、秘書）；center＝會長的中心；groups＝所屬審核群組與負責的中心（''＝全部中心）。 */
type ReviewScope = { all: boolean; center: string | null; groups: { groupId: string; centerKey: string }[] };
async function reviewScope(ctx: Ctx, s: Session): Promise<ReviewScope> {
  if (s.role === "admin") return { all: true, center: null, groups: [] };
  const { results } = await ctx.db.prepare("SELECT DISTINCT group_id, center_key FROM review_group_members WHERE member_sub = ?").bind(s.sub).all<{ group_id: string; center_key: string }>();
  return { all: false, center: s.roles.includes("president") ? (s.center?.key ?? null) : null, groups: results.map((r) => ({ groupId: r.group_id, centerKey: r.center_key })) };
}
const hasScope = (sc: ReviewScope) => sc.all || !!sc.center || sc.groups.length > 0;

/** 審核範圍的 SQL 條件（套用在 orders o）。 */
function scopeSql(sc: ReviewScope): { sql: string; args: unknown[] } {
  if (sc.all) return { sql: "1 = 1", args: [] };
  const parts: string[] = [];
  const args: unknown[] = [];
  if (sc.center) {
    parts.push("o.center_key = ?");
    args.push(sc.center);
  }
  for (const g of sc.groups) {
    parts.push(
      `EXISTS (SELECT 1 FROM order_items i JOIN courses c ON c.id = i.course_id WHERE i.order_id = o.id AND c.review_group_id = ?)${g.centerKey ? " AND o.center_key = ?" : ""}`,
    );
    args.push(g.groupId, ...(g.centerKey ? [g.centerKey] : []));
  }
  return { sql: parts.length ? `(${parts.map((p) => `(${p})`).join(" OR ")})` : "1 = 0", args };
}

async function canReviewOrder(ctx: Ctx, s: Session, orderId: string): Promise<boolean> {
  const sc = await reviewScope(ctx, s);
  if (!hasScope(sc)) return false;
  const w = scopeSql(sc);
  return !!(await ctx.db.prepare(`SELECT 1 AS ok FROM orders o WHERE o.id = ? AND ${w.sql}`).bind(orderId, ...w.args).first());
}

function titleOf(s: Session, duty?: string): string {
  const labels: Record<string, string> = { super_admin: "超級管理員", secretary: "總部秘書", president: "會長", register: "報名窗口", collect: "收費窗口", review: "審核員" };
  const role = ["super_admin", "secretary", "president"].find((r) => s.roles.includes(r));
  return labels[role ?? duty ?? ""] ?? (s.role === "admin" ? "管理員" : "");
}

function event(db: D1Database, orderId: string, actor: { sub: string; name: string; title: string }, action: string, x: { reason?: string | null; message?: string; note?: string } = {}): D1PreparedStatement {
  return db
    .prepare("INSERT INTO order_events (id, order_id, actor_sub, actor_name, actor_title, action, reason_code, message, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), orderId, actor.sub, actor.name, actor.title, action, x.reason ?? null, x.message ?? "", x.note ?? "", iso());
}

/** 付費報名要通知誰：同中心的群組成員＋該中心會長；非寰宇、沒有中心或該中心沒有窗口時改通知總部（秘書、超級管理員）。 */
async function reviewerNotices(ctx: Ctx, o: { id: string; centerKey: string | null; hglobal: boolean; groupId: string | null }, title: string, body: string): Promise<D1PreparedStatement[]> {
  const link = `/admin/orders/${o.id}`;
  const out: D1PreparedStatement[] = [];
  let desk: string[] = [];
  if (o.groupId) {
    const { results } = await ctx.db
      .prepare("SELECT DISTINCT member_sub FROM review_group_members WHERE group_id = ? AND (center_key = '' OR center_key = ?)")
      .bind(o.groupId, o.centerKey ?? "\u0000")
      .all<{ member_sub: string }>();
    desk = results.map((r) => r.member_sub);
  }
  for (const sub of desk) out.push(notify(ctx.db, { sub }, title, body, link));
  if (o.hglobal && o.centerKey) out.push(notify(ctx.db, { role: "president", centerKey: o.centerKey }, title, body, link));
  if (!o.hglobal || !o.centerKey || !desk.length) out.push(notify(ctx.db, { role: "admin" }, o.hglobal ? `${title}（該中心尚未設定窗口）` : `${title}（非寰宇系統學員）`, body, link));
  return out;
}

type RegItem = { courseId: string; runId: string };
async function createOrders(ctx: Ctx, body: { courseIds?: unknown; items?: unknown }): Promise<Order[]> {
  const s = requireMember(ctx);
  const raw: RegItem[] = [
    ...(Array.isArray(body.courseIds) ? body.courseIds.filter((x): x is string => typeof x === "string").map((courseId) => ({ courseId, runId: "" })) : []),
    ...(Array.isArray(body.items) ? (body.items as { courseId?: unknown; runId?: unknown }[]).filter((x) => typeof x?.courseId === "string").map((x) => ({ courseId: x.courseId as string, runId: typeof x.runId === "string" ? x.runId : "" })) : []),
  ];
  const items = [...new Map(raw.map((i) => [`${i.courseId}|${i.runId}`, i])).values()];
  if (!items.length || items.length > 20) fail(400, "invalid_courses", "請選擇要報名的課程");
  const ids = [...new Set(items.map((i) => i.courseId))];
  const marks = ids.map(() => "?").join(",");
  const [{ results: courses }, { results: runs }, rankMap, state] = await Promise.all([
    ctx.db
      .prepare(`SELECT id, title, price_twd, min_rank_code, free_from, free_until, review_group_id, allow_president FROM courses WHERE status = 'published' AND id IN (${marks})`)
      .bind(...ids)
      .all<{ id: string; title: string; price_twd: number; min_rank_code: string; free_from: string | null; free_until: string | null; review_group_id: string | null; allow_president: number }>(),
    ctx.db.prepare(`SELECT * FROM course_runs WHERE course_id IN (${marks})`).bind(...ids).all<RunRow>(),
    ranks(ctx.db),
    memberCourseState(ctx.db, s.sub),
  ]);
  if (courses.length !== ids.length) fail(409, "unavailable", "課程已下架或不存在，請重新確認");
  const eligibility = await eligibilityFor(s, rankMap, courses.map((c) => c.min_rank_code));
  if (courses.some((c) => eligibility.get(c.min_rank_code) !== true && !byPresident(s, c))) fail(403, "rank_required", "此課程需要符合資格才能報名");

  const now = new Date();
  const statements: D1PreparedStatement[] = [];
  const created: string[] = [];
  const actor = { sub: s.sub, name: s.name, title: "學員" };
  for (const item of items) {
    const c = courses.find((x) => x.id === item.courseId)!;
    const courseRuns = runs.filter((r) => r.course_id === c.id);
    let run: RunRow | undefined;
    if (courseRuns.length) {
      run = courseRuns.find((r) => r.id === item.runId) ?? fail(400, "run_required", "請選擇要報名的場次");
      const used = (await runUsage(ctx.db, c.id)).get(run.id) ?? 0;
      if (!runOpen(run, used)) fail(409, "run_closed", "這個場次已截止或額滿");
    } else if (item.runId) fail(400, "invalid_run", "場次不存在");
    const key = `${c.id}|${run?.id ?? ""}`;
    if (state.enrolled.has(key) || state.pending.has(key)) fail(409, "duplicate", "這門課程已報名（已開通或審核中），請勿重複報名");
    const price = inFreeWindow(c, iso(now)) ? 0 : (run?.price_twd ?? c.price_twd);
    const isFree = price === 0;
    if (!isFree && ctx.platform !== "web") fail(403, "web_only", "付費課程請至網頁版報名");
    const id = orderId(now);
    const title = run ? `${c.title}｜${run.title}` : c.title;
    created.push(id);
    statements.push(
      ctx.db
        .prepare(
          "INSERT INTO orders (id, member_sub, member_name_snapshot, status, total_twd, created_at, center_key, center_label, hglobal, paid_twd, pay_method, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id, s.sub, s.name, isFree ? "opened" : "pending", price, iso(now), s.center?.key ?? null, s.center?.label ?? "", s.hglobal ? 1 : 0, isFree ? 0 : null, isFree ? "free" : null, isFree ? iso(now) : null),
      ctx.db.prepare("INSERT INTO order_items (order_id, course_id, run_id, title_snapshot, price_twd) VALUES (?, ?, ?, ?, ?)").bind(id, c.id, run?.id ?? "", title, price),
      event(ctx.db, id, actor, "submit"),
      audit(ctx.db, s.sub, isFree ? "order.register_free" : "order.register", "order", id, title),
    );
    if (isFree) {
      // 免費課程立即開通；PRIMARY KEY 保證同一會員同一場只會開通一次（重複請求整批失敗）。
      statements.push(
        ctx.db.prepare("INSERT INTO enrollments (member_sub, course_id, run_id, source_order_id) VALUES (?, ?, ?, ?)").bind(s.sub, c.id, run?.id ?? "", id),
        notify(ctx.db, { sub: s.sub }, "課程已開通", title, "/learning"),
      );
    } else {
      statements.push(
        notify(ctx.db, { sub: s.sub }, "報名已送出，等待審核", title, `/orders/${id}`),
        ...(await reviewerNotices(ctx, { id, centerKey: s.center?.key ?? null, hglobal: s.hglobal, groupId: c.review_group_id }, "有新的報名待審核", `${s.name}｜${title}｜NT$${price.toLocaleString("en-US")}`)),
      );
    }
  }
  try {
    await ctx.db.batch(statements);
  } catch {
    fail(409, "duplicate", "這門課程已經報名過了");
  }
  const { results } = await ctx.db.prepare(`${ORDER_SELECT} WHERE o.id IN (${created.map(() => "?").join(",")})`).bind(...created).all<OrderRow>();
  return hydrateOrders(ctx.db, results);
}

/** 單筆報名明細：本人或有審核權限者可看；含操作紀錄（私人備註只給審核人員）與該中心的收費窗口。 */
async function orderDetail(ctx: Ctx, id: string): Promise<Order> {
  const s = requireMember(ctx);
  const row = await ctx.db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first<OrderRow>();
  if (!row) return fail(404, "not_found", "找不到這筆報名");
  const reviewer = await canReviewOrder(ctx, s, id);
  if (row.member_sub !== s.sub && !reviewer) fail(404, "not_found", "找不到這筆報名");
  const [order] = await hydrateOrders(ctx.db, [row]);
  const [events, collectors] = await Promise.all([
    ctx.db.prepare("SELECT id, actor_sub, actor_name, actor_title, action, reason_code, message, note, created_at FROM order_events WHERE order_id = ? ORDER BY created_at, rowid").bind(id).all<{
      id: string;
      actor_sub: string;
      actor_name: string;
      actor_title: string;
      action: OrderEvent["action"];
      reason_code: string | null;
      message: string;
      note: string;
      created_at: string;
    }>(),
    ctx.db
      .prepare(
        "SELECT DISTINCT m.member_name FROM review_group_members m JOIN courses c ON c.review_group_id = m.group_id JOIN order_items i ON i.course_id = c.id WHERE i.order_id = ? AND m.duty = 'collect' AND m.member_name <> '' AND (m.center_key = ? OR (m.center_key = '' AND NOT EXISTS (SELECT 1 FROM review_group_members x WHERE x.group_id = m.group_id AND x.duty = 'collect' AND x.center_key = ?)))",
      )
      .bind(id, row.center_key ?? "\u0000", row.center_key ?? "\u0000")
      .all<{ member_name: string }>(),
  ]);
  return {
    ...order,
    events: events.results
      .filter((e) => reviewer || e.action !== "note")
      .map((e) => ({
        id: e.id,
        action: e.action,
        actorName: e.actor_name,
        actorTitle: e.actor_title,
        mine: e.actor_sub === s.sub,
        reason: e.reason_code ? (REVIEW_REASONS[e.reason_code as ReviewReason] ?? e.reason_code) : null,
        message: e.message,
        ...(reviewer ? { note: e.note } : {}),
        createdAt: e.created_at,
      })),
    collectors: collectors.results.map((c) => c.member_name),
    canReview: reviewer && (row.member_sub !== s.sub || s.role === "admin"),
    canRevoke: s.role === "admin" && row.status === "opened" && row.total_twd > 0,
  };
}

/** 登入時把會員中心的聯絡信箱同步成副本，並記下是否為管理員／哪個中心的會長（寄給角色型通知用）。 */
async function syncContact(ctx: Ctx, s: Session): Promise<void> {
  const president = s.roles.includes("president") && s.center ? s.center.key : null;
  let email: string | null | undefined;
  if (s.kind === "central") email = await contactEmail(s.sub, s.token);
  if (email === undefined) {
    // 查不到（或模擬會員）：不動信箱，只更新身分欄位。
    await ctx.db
      .prepare("INSERT INTO member_contacts (member_sub, is_admin, president_center_key) VALUES (?, ?, ?) ON CONFLICT(member_sub) DO UPDATE SET is_admin = excluded.is_admin, president_center_key = excluded.president_center_key")
      .bind(s.sub, s.role === "admin" ? 1 : 0, president)
      .run();
    return;
  }
  await ctx.db
    .prepare(
      "INSERT INTO member_contacts (member_sub, email, is_admin, president_center_key) VALUES (?, ?, ?, ?) ON CONFLICT(member_sub) DO UPDATE SET email = excluded.email, is_admin = excluded.is_admin, president_center_key = excluded.president_center_key, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
    )
    .bind(s.sub, email, s.role === "admin" ? 1 : 0, president)
    .run();
}

async function contactSettings(ctx: Ctx, s: Session): Promise<NotificationSettings> {
  const row = await ctx.db.prepare("SELECT email, notify_email FROM member_contacts WHERE member_sub = ?").bind(s.sub).first<{ email: string | null; notify_email: number }>();
  return { email: row?.email ?? null, notifyEmail: (row?.notify_email ?? 1) === 1, emailReady: !!ctx.env.EMAIL && !!ctx.env.EMAIL_FROM, source: s.kind === "central" ? "central" : "local" };
}

async function dutyOf(ctx: Ctx, s: Session): Promise<string | undefined> {
  const r = await ctx.db.prepare("SELECT duty FROM review_group_members WHERE member_sub = ? LIMIT 1").bind(s.sub).first<{ duty: string }>();
  return r?.duty;
}

/** 審核：已繳費／VIP 免繳費／退回／延後再審／撤銷開通（撤銷限秘書與超級管理員）。 */
async function reviewOrder(ctx: Ctx, id: string, body: Record<string, unknown>): Promise<Order> {
  const s = requireMember(ctx);
  if (ctx.platform !== "web") fail(403, "web_only", "報名審核請至網頁版辦理");
  const action = body.action as ReviewAction;
  if (!["paid", "vip", "reject", "defer", "revoke"].includes(action)) fail(400, "invalid_action", "審核動作不正確");
  const order = await ctx.db.prepare("SELECT id, member_sub, status, total_twd FROM orders WHERE id = ?").bind(id).first<{ id: string; member_sub: string; status: string; total_twd: number }>();
  if (!order || !(await canReviewOrder(ctx, s, id))) return fail(404, "not_found", "找不到這筆報名");
  if (order.member_sub === s.sub && s.role !== "admin") fail(403, "self_review", "不能審核自己的報名");
  if (action === "revoke") {
    if (s.role !== "admin") fail(403, "forbidden", "只有總部秘書與超級管理員可以撤銷開通");
    if (order.status !== "opened") fail(409, "not_opened", "這筆報名尚未開通");
  } else if (order.status !== "pending") fail(409, "already_reviewed", "這筆報名已審核過");

  const message = text(body.message, 500) ?? "";
  const note = text(body.note, 500) ?? "";
  const needsReason = action === "reject" || action === "defer" || action === "revoke";
  const code = typeof body.reasonCode === "string" && body.reasonCode in REVIEW_REASONS ? (body.reasonCode as ReviewReason) : null;
  if (needsReason && !code) fail(400, "reason_required", "請選擇原因");
  if (needsReason && code === "other" && !message) fail(400, "reason_required", "請填寫原因");
  const reasonText = code ? (code === "other" ? message : REVIEW_REASONS[code]) : null;
  const now = iso();
  const actor = { sub: s.sub, name: s.name, title: titleOf(s, await dutyOf(ctx, s)) };
  const by = `${actor.title ? `${actor.title} ` : ""}${actor.name}`;
  const statements: D1PreparedStatement[] = [];
  const guard = action === "revoke" ? "status = 'opened'" : "status = 'pending'";
  if (action === "paid" || action === "vip") {
    const method = action === "vip" ? "vip" : body.payMethod === "transfer" ? "transfer" : "cash";
    const paid = action === "vip" ? 0 : body.paidTwd === undefined ? order.total_twd : Number(body.paidTwd);
    if (!Number.isInteger(paid) || paid < 0 || paid > 10_000_000) fail(400, "invalid_amount", "實收金額不正確");
    statements.push(
      ctx.db
        .prepare(`UPDATE orders SET status = 'opened', deferred = 0, reject_reason = NULL, reviewed_by_sub = ?, reviewed_at = ?, paid_twd = ?, pay_method = ?, paid_at = ? WHERE id = ? AND ${guard}`)
        .bind(s.sub, now, paid, method, now, id),
      ctx.db
        .prepare("INSERT OR IGNORE INTO enrollments (member_sub, course_id, run_id, source_order_id) SELECT o.member_sub, i.course_id, i.run_id, o.id FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = ? AND o.status = 'opened'")
        .bind(id),
      notify(ctx.db, { sub: order.member_sub }, action === "vip" ? "報名審核通過（VIP 免繳費），課程已開通" : "繳費確認完成，課程已開通", `審核人員：${by}${message ? `\n留言：${message}` : ""}`, `/orders/${id}`),
    );
  } else if (action === "reject" || action === "revoke") {
    statements.push(
      ctx.db
        .prepare(`UPDATE orders SET status = 'rejected', deferred = 0, reject_reason = ?, reviewed_by_sub = ?, reviewed_at = ?${action === "revoke" ? ", revoked_at = ?" : ""} WHERE id = ? AND ${guard}`)
        .bind(reasonText, s.sub, now, ...(action === "revoke" ? [now] : []), id),
      ...(action === "revoke" ? [ctx.db.prepare("DELETE FROM enrollments WHERE source_order_id = ?").bind(id)] : []),
      notify(ctx.db, { sub: order.member_sub }, action === "revoke" ? "課程開通已撤銷" : "報名已退回", `原因：${reasonText}\n審核人員：${by}`, `/orders/${id}`),
    );
  } else {
    statements.push(
      ctx.db.prepare(`UPDATE orders SET deferred = 1, reject_reason = ?, reviewed_by_sub = ?, reviewed_at = ? WHERE id = ? AND ${guard}`).bind(reasonText, s.sub, now, id),
      notify(ctx.db, { sub: order.member_sub }, "報名延後審核", `原因：${reasonText}\n審核人員：${by}`, `/orders/${id}`),
    );
  }
  statements.push(event(ctx.db, id, actor, action, { reason: code, message, note }), audit(ctx.db, s.sub, `order.${action}`, "order", id, code ?? ""));
  const [update] = await ctx.db.batch(statements);
  if (update.meta?.changes === 0) fail(409, "already_reviewed", "這筆報名已由其他人處理");
  return orderDetail(ctx, id);
}

/** 留言（雙方可見，通知對方）或私人備註（只有審核人員可見）。 */
async function addOrderEvent(ctx: Ctx, id: string, body: Record<string, unknown>): Promise<Order> {
  const s = requireMember(ctx);
  const order = await ctx.db.prepare("SELECT member_sub FROM orders WHERE id = ?").bind(id).first<{ member_sub: string }>();
  const reviewer = !!order && order.member_sub !== s.sub && (await canReviewOrder(ctx, s, id));
  if (!order || (order.member_sub !== s.sub && !reviewer)) return fail(404, "not_found", "找不到這筆報名");
  const message = text(body.message, 500) ?? "";
  const note = reviewer ? (text(body.note, 500) ?? "") : "";
  if (!message && !note) fail(400, "empty", "請輸入內容");
  const actor = { sub: s.sub, name: s.name, title: reviewer ? titleOf(s, await dutyOf(ctx, s)) : "學員" };
  const statements = [event(ctx.db, id, actor, message ? "message" : "note", { message, note })];
  if (message && reviewer) statements.push(notify(ctx.db, { sub: order.member_sub }, "報名有新留言", `${actor.title} ${actor.name}：${message}`, `/orders/${id}`));
  if (message && !reviewer) {
    // 學員留言：通知處理過這筆報名的審核人員；還沒有人處理時，審核人員會在審核清單看到。
    const { results } = await ctx.db.prepare("SELECT DISTINCT actor_sub FROM order_events WHERE order_id = ? AND actor_sub <> ? AND action <> 'submit'").bind(id, s.sub).all<{ actor_sub: string }>();
    for (const r of results) statements.push(notify(ctx.db, { sub: r.actor_sub }, "學員在報名紀錄留言", `${s.name}：${message}`, `/admin/orders/${id}`));
  }
  await ctx.db.batch(statements);
  return orderDetail(ctx, id);
}

async function reviewList(ctx: Ctx): Promise<{ rows: OrderRow[]; scope: ReviewScope }> {
  const s = requireMember(ctx);
  const scope = await reviewScope(ctx, s);
  if (!hasScope(scope)) fail(403, "forbidden", "需要審核權限");
  const w = scopeSql(scope);
  const q = ctx.url.searchParams;
  const conds = [w.sql, "o.total_twd > 0"];
  const args = [...w.args];
  const add = (cond: string, ...values: unknown[]) => {
    conds.push(cond);
    args.push(...values);
  };
  const status = q.get("status");
  if (status === "pending") add("o.status = 'pending' AND o.deferred = 0");
  else if (status === "deferred") add("o.status = 'pending' AND o.deferred = 1");
  else if (status === "opened" || status === "rejected") add("o.status = ?", status);
  if (q.get("courseId")) add("EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.course_id = ?)", q.get("courseId"));
  if (q.get("runId")) add("EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.run_id = ?)", q.get("runId"));
  if (q.get("center")) add("o.center_key = ?", centerKey(q.get("center")!));
  if (q.get("hglobal") === "0") add("o.hglobal = 0");
  const term = (q.get("q") ?? "").trim().slice(0, 50);
  if (term) add("(o.member_name_snapshot LIKE ? OR o.id LIKE ?)", `%${term}%`, `%${term}%`);
  const { results } = await ctx.db.prepare(`${ORDER_SELECT} WHERE ${conds.join(" AND ")} ORDER BY o.created_at DESC LIMIT 2000`).bind(...args).all<OrderRow>();
  return { rows: results, scope };
}

const csvCell = (v: unknown) => {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // 避免試算表把內容當成公式
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** 對帳報表（CSV，Excel 可直接開啟）：範圍與審核清單相同。 */
async function reviewCsv(ctx: Ctx): Promise<Response> {
  const { rows } = await reviewList(ctx);
  const orders = await hydrateOrders(ctx.db, rows);
  const reviewers = new Map<string, string>();
  if (rows.length) {
    const { results } = await ctx.db
      .prepare("SELECT order_id, actor_title, actor_name FROM order_events WHERE action IN ('paid', 'vip', 'reject', 'defer', 'revoke') ORDER BY created_at")
      .all<{ order_id: string; actor_title: string; actor_name: string }>();
    for (const r of results) reviewers.set(r.order_id, `${r.actor_title} ${r.actor_name}`.trim());
  }
  const statusLabel = (o: Order) => (o.revoked ? "已撤銷" : o.status === "opened" ? "已開通" : o.status === "rejected" ? "已退回" : o.deferred ? "延後再審" : "待審核");
  const method: Record<string, string> = { cash: "現金", transfer: "轉帳", vip: "VIP 免繳費", online: "線上", free: "免費" };
  const lines = [
    ["報名編號", "報名時間", "課程／場次", "姓名", "中心", "寰宇系統", "狀態", "應繳", "實收", "繳費方式", "審核人員", "審核時間", "原因"],
    ...orders.map((o) => [o.id, o.createdAt, o.items.map((i) => i.title).join("、"), o.memberName, o.centerLabel, o.hglobal ? "是" : "否", statusLabel(o), o.totalTwd, o.paidTwd ?? "", o.payMethod ? method[o.payMethod] : "", reviewers.get(o.id) ?? "", o.reviewedAt ?? "", o.rejectReason ?? ""]),
  ];
  await audit(ctx.db, ctx.session!.sub, "order.export", "report", "csv", String(orders.length)).run();
  return new Response("﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="registrations-${iso().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
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
  if (body.allowPresident !== undefined) sets.push(["allow_president", body.allowPresident === true ? 1 : 0]);
  const guidance = text(body.guidanceUnit, 60);
  if (guidance !== undefined) sets.push(["guidance_unit", guidance]);
  const host = text(body.hostUnit, 100);
  if (host !== undefined) sets.push(["host_unit", host], ["host_center_key", host && host !== HQ_UNIT ? centerKey(host) : null]);
  for (const [k, col] of [["freeFrom", "free_from"], ["freeUntil", "free_until"]] as const) {
    const v = isoOrNull(body[k]);
    if (v !== undefined) sets.push([col, v]);
  }
  if (body.reviewGroupId !== undefined) {
    if (body.reviewGroupId === null || body.reviewGroupId === "") sets.push(["review_group_id", null]);
    else {
      const g = await ctx.db.prepare("SELECT owner_center_key FROM review_groups WHERE id = ?").bind(String(body.reviewGroupId)).first<{ owner_center_key: string | null }>();
      if (!g) fail(400, "invalid_group", "審核群組不存在");
      sets.push(["review_group_id", body.reviewGroupId]);
    }
  }
  return sets;
}

/** 指導單位為寰宇總部的課程，只能套用總部群組（由秘書、超級管理員指派審核人員）。 */
async function checkGuidanceGroup(ctx: Ctx, guidance: unknown, groupId: unknown) {
  if (guidance !== HQ_UNIT || !groupId) return;
  const g = await ctx.db.prepare("SELECT owner_center_key FROM review_groups WHERE id = ?").bind(String(groupId)).first<{ owner_center_key: string | null }>();
  if (g?.owner_center_key) fail(400, "hq_group_required", `指導單位為「${HQ_UNIT}」的課程只能使用總部的審核群組`);
}

async function createCourse(ctx: Ctx, admin: Session) {
  const body = await readJson<Record<string, unknown>>(ctx.req);
  const sets = await courseFields(ctx, body, true);
  await checkGuidanceGroup(ctx, body.guidanceUnit, body.reviewGroupId);
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
  const cur = await ctx.db.prepare("SELECT guidance_unit, review_group_id FROM courses WHERE id = ?").bind(id).first<{ guidance_unit: string; review_group_id: string | null }>();
  const pick = (col: string, old: unknown) => (sets.find(([c]) => c === col) ?? [col, old])[1];
  await checkGuidanceGroup(ctx, pick("guidance_unit", cur?.guidance_unit), pick("review_group_id", cur?.review_group_id));
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
  if ((body as { runId?: unknown }).runId !== undefined) {
    const runId = (body as { runId?: unknown }).runId;
    if (runId === null || runId === "") sets.push(["run_id", null]);
    else {
      const ok = await ctx.db.prepare("SELECT 1 AS ok FROM course_runs r JOIN lessons l ON l.course_id = r.course_id WHERE r.id = ? AND l.id = ?").bind(String(runId), id).first();
      if (!ok) fail(400, "invalid_run", "場次不存在");
      sets.push(["run_id", runId]);
    }
  }
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

// ---------- 審核群組、場次、通知範圍 ----------

/** 這位登入者看得到的通知：自己的、（管理員）寄給總部的、（會長）寄給自己中心會長的。 */
function noticeScope(s: Session): { sql: string; args: unknown[] } {
  const parts = ["recipient_sub = ?"];
  const args: unknown[] = [s.sub];
  if (s.role === "admin") parts.push("recipient_role = 'admin'");
  if (s.roles.includes("president") && s.center) {
    parts.push("(recipient_role = 'president' AND recipient_center_key = ?)");
    args.push(s.center.key);
  }
  return { sql: `(${parts.join(" OR ")})`, args };
}

/** 中心自辦群組：該中心的會長、音控可管理。 */
const canManageCenter = (s: Session, key: string) => !!s.center && s.center.key === key && (s.roles.includes("president") || s.roles.includes("sound"));

async function requireGroupManager(ctx: Ctx, groupId: string): Promise<Session> {
  const s = requireMember(ctx);
  const g = await ctx.db.prepare("SELECT owner_center_key FROM review_groups WHERE id = ?").bind(groupId).first<{ owner_center_key: string | null }>();
  if (!g) return fail(404, "not_found", "找不到這個審核群組");
  // 總部群組（owner_center_key 為 NULL）只有秘書與超級管理員可以指派。
  if (s.role !== "admin" && !(g.owner_center_key && canManageCenter(s, g.owner_center_key))) fail(403, "forbidden", "沒有管理這個群組的權限");
  return s;
}

async function listGroups(ctx: Ctx): Promise<ReviewGroup[]> {
  const s = requireMember(ctx);
  const manager = s.role === "admin" || s.roles.includes("president") || s.roles.includes("sound");
  if (!manager) fail(403, "forbidden", "沒有管理審核群組的權限");
  const [g, m, c] = await ctx.db.batch([
    ctx.db.prepare("SELECT id, name, owner_center_key, owner_center_label FROM review_groups ORDER BY created_at"),
    ctx.db.prepare("SELECT group_id, center_key, center_label, member_sub, member_name, duty FROM review_group_members ORDER BY center_label, created_at"),
    ctx.db.prepare("SELECT id, title, review_group_id FROM courses WHERE review_group_id IS NOT NULL"),
  ]);
  type G = { id: string; name: string; owner_center_key: string | null; owner_center_label: string };
  type M = { group_id: string; center_key: string; center_label: string; member_sub: string; member_name: string; duty: Duty };
  return (g.results as G[])
    .filter((x) => s.role === "admin" || (x.owner_center_key && canManageCenter(s, x.owner_center_key)))
    .map((x) => ({
      id: x.id,
      name: x.name,
      ownerCenter: x.owner_center_key ? x.owner_center_label : null,
      courses: (c.results as { id: string; title: string; review_group_id: string }[]).filter((k) => k.review_group_id === x.id).map((k) => ({ id: k.id, title: k.title })),
      members: (m.results as M[]).filter((k) => k.group_id === x.id).map((k) => ({ centerKey: k.center_key, centerLabel: k.center_label, memberSub: k.member_sub, memberName: k.member_name, duty: k.duty })),
      canManage: true,
    }));
}

const isoOrNull = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) fail(400, "invalid_date", "日期格式不正確");
  return d.toISOString();
};

function runFields(body: Record<string, unknown>, creating: boolean): [string, unknown][] {
  const sets: [string, unknown][] = [];
  const title = text(body.title, 80);
  if (title !== undefined || creating) sets.push(["title", title || fail(400, "title_required", "請輸入場次名稱")]);
  const loc = text(body.location, 120);
  if (loc !== undefined) sets.push(["location", loc]);
  for (const [k, col] of [["startsAt", "starts_at"], ["registerUntil", "register_until"]] as const) {
    const v = isoOrNull(body[k]);
    if (v !== undefined) sets.push([col, v]);
  }
  for (const [k, col, max] of [["capacity", "capacity", 100000], ["priceTwd", "price_twd", 10_000_000]] as const) {
    if (body[k] === undefined) continue;
    if (body[k] === null || body[k] === "") sets.push([col, null]);
    else {
      const n = Number(body[k]);
      if (!Number.isInteger(n) || n < (col === "capacity" ? 1 : 0) || n > max) fail(400, "invalid_number", col === "capacity" ? "名額請輸入正整數" : "費用請輸入 0 以上的整數");
      sets.push([col, n]);
    }
  }
  if (body.status !== undefined) sets.push(["status", body.status === "closed" ? "closed" : "open"]);
  return sets;
}

// ---------- 課程留言板 ----------

type CommentRow = { id: string; course_id: string; member_sub: string; member_name: string; body: string; status: "visible" | "hidden"; created_at: string; reports?: number; course_title?: string };
const toComment = (r: CommentRow, s: Session): CourseComment => ({
  id: r.id,
  courseId: r.course_id,
  authorName: r.member_name,
  mine: r.member_sub === s.sub,
  body: r.body,
  hidden: r.status === "hidden",
  createdAt: r.created_at,
  ...(r.reports !== undefined ? { reports: r.reports, courseTitle: r.course_title } : {}),
});

async function requireCourseForComments(ctx: Ctx, courseId: string): Promise<Session> {
  const s = requireMember(ctx);
  const c = await ctx.db.prepare("SELECT status FROM courses WHERE id = ?").bind(courseId).first<{ status: string }>();
  if (!c || (c.status !== "published" && s.role !== "admin")) fail(404, "not_found", "找不到這門課程");
  return s;
}

async function listComments(ctx: Ctx, courseId: string): Promise<CourseComment[]> {
  const s = await requireCourseForComments(ctx, courseId);
  // 一般會員看不到被隱藏的留言與自己封鎖的人；管理員看得到全部。
  const { results } = await ctx.db
    .prepare(
      `SELECT id, course_id, member_sub, member_name, body, status, created_at FROM course_comments c WHERE course_id = ?
       AND (? = 'admin' OR (status = 'visible' AND NOT EXISTS (SELECT 1 FROM comment_blocks b WHERE b.member_sub = ? AND b.blocked_sub = c.member_sub)))
       ORDER BY created_at DESC LIMIT 200`,
    )
    .bind(courseId, s.role, s.sub)
    .all<CommentRow>();
  return results.map((r) => toComment(r, s));
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
      const session: Session = { kind: "demo", sub: m.sub, name: m.name, rankCode: m.rankCode, role: m.role, roles: m.roles ?? [], hglobal: m.hglobal ?? false, center: m.center ? { key: centerKey(m.center), label: m.center } : null };
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
  [
    "GET",
    /^\/me\/notification-settings$/,
    async (ctx) => {
      const s = requireMember(ctx);
      await syncContact(ctx, s).catch(() => undefined);
      return contactSettings(ctx, s);
    },
  ],
  [
    "PUT",
    /^\/me\/notification-settings$/,
    async (ctx) => {
      const s = requireMember(ctx);
      const body = await readJson<{ email?: unknown; notifyEmail?: unknown }>(ctx.req);
      let email: string | null | undefined;
      if (body.email !== undefined) {
        if (body.email === null || body.email === "") email = null;
        else if (typeof body.email === "string" && validEmail(body.email.trim())) email = body.email.trim().toLowerCase();
        else return fail(400, "invalid_email", "Email 格式不正確");
      }
      if (body.notifyEmail !== undefined && typeof body.notifyEmail !== "boolean") return fail(400, "invalid_request", "通知方式格式不正確");
      await syncContact(ctx, s).catch(() => undefined);
      if (email !== undefined) {
        // 正本在會員中心：先寫回中央，成功才更新這裡的副本。
        if (s.kind === "central" && !(await saveContactEmail(s.sub, s.token, email))) return fail(502, "central_unavailable", "會員中心暫時無法儲存，請稍後再試");
        await ctx.db
          .prepare("INSERT INTO member_contacts (member_sub, email) VALUES (?, ?) ON CONFLICT(member_sub) DO UPDATE SET email = excluded.email, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
          .bind(s.sub, email)
          .run();
      }
      if (typeof body.notifyEmail === "boolean") {
        await ctx.db
          .prepare("INSERT INTO member_contacts (member_sub, notify_email) VALUES (?, ?) ON CONFLICT(member_sub) DO UPDATE SET notify_email = excluded.notify_email")
          .bind(s.sub, body.notifyEmail ? 1 : 0)
          .run();
      }
      return contactSettings(ctx, s);
    },
  ],
  [
    "GET",
    /^\/me$/,
    async (ctx) => {
      const s = ctx.session;
      if (!s) return { member: null };
      const { results } = await ctx.db.prepare("SELECT DISTINCT duty FROM review_group_members WHERE member_sub = ?").bind(s.sub).all<{ duty: Duty }>();
      // 被指派為窗口的人登入時，補上／更新名單上的姓名。
      if (results.length) await ctx.db.prepare("UPDATE review_group_members SET member_name = ? WHERE member_sub = ? AND member_name <> ?").bind(s.name, s.sub, s.name).run();
      const labels: Record<Duty, string> = { register: "報名窗口", collect: "收費窗口", review: "審核員" };
      await syncContact(ctx, s).catch(() => undefined);
      return { member: memberOf(s, await ranks(ctx.db), { duties: results.map((r) => labels[r.duty]) }) };
    },
  ],
  [
    "DELETE",
    /^\/me$/,
    async (ctx) => {
      // 模擬會員：清除這位會員在本 App 的所有資料。串接中央會員後改為導向官方刪除流程。
      const s = requireMember(ctx);
      await ctx.db.batch([
        ctx.db.prepare("DELETE FROM course_comments WHERE member_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM comment_blocks WHERE member_sub = ? OR blocked_sub = ?").bind(s.sub, s.sub),
        ctx.db.prepare("DELETE FROM comment_reports WHERE reporter_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM lesson_progress WHERE member_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM enrollments WHERE member_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM orders WHERE member_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM notifications WHERE recipient_sub = ?").bind(s.sub),
        ctx.db.prepare("DELETE FROM member_contacts WHERE member_sub = ?").bind(s.sub),
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
      const target = await lessonOf(ctx, courseId, lessonId);
      if (!(await canWatch(ctx, courseId, target.run_id))) fail(403, "not_enrolled", "請先報名並通過審核");
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
      if (!(await canWatch(ctx, courseId, lesson.run_id))) fail(403, "not_enrolled", "請先報名並通過審核");
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
      const { results } = await ctx.db.prepare(`${ORDER_SELECT} WHERE o.member_sub = ? ORDER BY o.created_at DESC LIMIT 200`).bind(s.sub).all<OrderRow>();
      return hydrateOrders(ctx.db, results);
    },
  ],
  ["GET", /^\/orders\/([\w-]+)$/, async (ctx, [id]) => orderDetail(ctx, id)],
  ["POST", /^\/orders\/([\w-]+)\/events$/, async (ctx, [id]) => addOrderEvent(ctx, id, await readJson(ctx.req))],
  [
    "GET",
    /^\/notifications$/,
    async (ctx) => {
      const s = requireMember(ctx);
      const n = noticeScope(s);
      const { results } = await ctx.db
        .prepare(`SELECT id, title, body, link, read_at, created_at FROM notifications WHERE ${n.sql} ORDER BY created_at DESC LIMIT 100`)
        .bind(...n.args)
        .all<{ id: string; title: string; body: string; link: string; read_at: string | null; created_at: string }>();
      return results.map((x): Notice => ({ id: x.id, title: x.title, body: x.body, link: x.link, read: !!x.read_at, createdAt: x.created_at }));
    },
  ],
  [
    "POST",
    /^\/notifications\/read-all$/,
    async (ctx) => {
      const n = noticeScope(requireMember(ctx));
      await ctx.db.prepare(`UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND ${n.sql}`).bind(iso(), ...n.args).run();
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/notifications\/([\w-]+)\/read$/,
    async (ctx, [id]) => {
      const n = noticeScope(requireMember(ctx));
      await ctx.db.prepare(`UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND ${n.sql}`).bind(iso(), id, ...n.args).run();
      return { ok: true };
    },
  ],
  ["GET", /^\/admin\/orders$/, async (ctx) => hydrateOrders(ctx.db, (await reviewList(ctx)).rows.slice(0, 300))],
  ["GET", /^\/admin\/orders\.csv$/, async (ctx) => reviewCsv(ctx)],
  ["POST", /^\/admin\/orders\/([\w-]+)\/review$/, async (ctx, [id]) => reviewOrder(ctx, id, await readJson(ctx.req))],
  [
    "GET",
    /^\/centers$/,
    async (ctx) => {
      const s = requireMember(ctx);
      const fromCentral = s.kind === "central" ? await centerList(s.token) : ["台北中心", "台中中心", "高雄中心"];
      const { results } = await ctx.db.prepare("SELECT DISTINCT center_label AS l FROM orders WHERE center_label <> '' UNION SELECT DISTINCT center_label FROM review_group_members WHERE center_label <> ''").all<{ l: string }>();
      const seen = new Map<string, string>();
      for (const l of [...fromCentral, ...results.map((r) => r.l)]) if (!seen.has(centerKey(l))) seen.set(centerKey(l), l);
      return [...seen.values()];
    },
  ],
  ["GET", /^\/courses\/([\w-]+)\/comments$/, async (ctx, [id]) => listComments(ctx, id)],
  [
    "POST",
    /^\/courses\/([\w-]+)\/comments$/,
    async (ctx, [courseId]) => {
      const s = await requireCourseForComments(ctx, courseId);
      const body = text((await readJson<{ body?: unknown }>(ctx.req)).body, 500) || fail(400, "empty", "請輸入留言內容");
      const recent = await ctx.db.prepare("SELECT COUNT(*) AS n FROM course_comments WHERE member_sub = ? AND created_at > ?").bind(s.sub, iso(new Date(Date.now() - 600_000))).first<{ n: number }>();
      if ((recent?.n ?? 0) >= 5) fail(429, "too_many", "留言太頻繁了，請稍後再試");
      await ctx.db.prepare("INSERT INTO course_comments (id, course_id, member_sub, member_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), courseId, s.sub, s.name, body, iso()).run();
      return listComments(ctx, courseId);
    },
  ],
  [
    "DELETE",
    /^\/comments\/([\w-]+)$/,
    async (ctx, [id]) => {
      const s = requireMember(ctx);
      const res = await ctx.db.prepare("DELETE FROM course_comments WHERE id = ? AND member_sub = ?").bind(id, s.sub).run();
      if (res.meta?.changes === 0) fail(404, "not_found", "找不到這則留言");
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/comments\/([\w-]+)\/report$/,
    async (ctx, [id]) => {
      const s = requireMember(ctx);
      const c = await ctx.db.prepare("SELECT c.member_sub, c.body, k.title FROM course_comments c JOIN courses k ON k.id = c.course_id WHERE c.id = ? AND c.status = 'visible'").bind(id).first<{ member_sub: string; body: string; title: string }>();
      if (!c) return fail(404, "not_found", "找不到這則留言");
      if (c.member_sub === s.sub) fail(400, "own_comment", "不能檢舉自己的留言");
      const reason = text((await readJson<{ reason?: unknown }>(ctx.req)).reason, 200) ?? "";
      const first = !(await ctx.db.prepare("SELECT 1 AS ok FROM comment_reports WHERE comment_id = ? LIMIT 1").bind(id).first());
      await ctx.db.batch([
        ctx.db.prepare("INSERT OR IGNORE INTO comment_reports (comment_id, reporter_sub, reason) VALUES (?, ?, ?)").bind(id, s.sub, reason),
        // 同一則留言只在第一次被檢舉時通知總部，避免洗版。
        ...(first ? [notify(ctx.db, { role: "admin" }, "有留言被檢舉", `${c.title}：${c.body.slice(0, 60)}`, "/admin/comments")] : []),
      ]);
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/comments\/([\w-]+)\/block$/,
    async (ctx, [id]) => {
      const s = requireMember(ctx);
      const c = await ctx.db.prepare("SELECT member_sub FROM course_comments WHERE id = ?").bind(id).first<{ member_sub: string }>();
      if (!c) return fail(404, "not_found", "找不到這則留言");
      if (c.member_sub === s.sub) fail(400, "own_comment", "不能封鎖自己");
      await ctx.db.prepare("INSERT OR IGNORE INTO comment_blocks (member_sub, blocked_sub) VALUES (?, ?)").bind(s.sub, c.member_sub).run();
      return { ok: true };
    },
  ],
  [
    "GET",
    /^\/admin\/comments$/,
    async (ctx) => {
      const s = requireAdmin(ctx);
      const { results } = await ctx.db
        .prepare(
          `SELECT c.id, c.course_id, c.member_sub, c.member_name, c.body, c.status, c.created_at, k.title AS course_title,
           (SELECT COUNT(*) FROM comment_reports r WHERE r.comment_id = c.id) AS reports
           FROM course_comments c JOIN courses k ON k.id = c.course_id
           WHERE c.status = 'hidden' OR EXISTS (SELECT 1 FROM comment_reports r WHERE r.comment_id = c.id)
           ORDER BY c.created_at DESC LIMIT 200`,
        )
        .all<CommentRow>();
      return results.map((r) => toComment(r, s));
    },
  ],
  [
    "PATCH",
    /^\/admin\/comments\/([\w-]+)$/,
    async (ctx, [id]) => {
      const s = requireAdmin(ctx);
      const body = await readJson<{ hidden?: unknown; dismiss?: unknown }>(ctx.req);
      const statements = [audit(ctx.db, s.sub, body.dismiss === true ? "comment.dismiss_reports" : body.hidden === true ? "comment.hide" : "comment.show", "comment", id)];
      if (body.dismiss === true) statements.push(ctx.db.prepare("DELETE FROM comment_reports WHERE comment_id = ?").bind(id));
      else statements.push(ctx.db.prepare("UPDATE course_comments SET status = ?, hidden_by_sub = ? WHERE id = ?").bind(body.hidden === true ? "hidden" : "visible", body.hidden === true ? s.sub : null, id));
      await ctx.db.batch(statements);
      return { ok: true };
    },
  ],
  ["GET", /^\/admin\/review-groups$/, async (ctx) => listGroups(ctx)],
  [
    "POST",
    /^\/admin\/review-groups$/,
    async (ctx) => {
      const s = requireMember(ctx);
      const body = await readJson<{ name?: unknown; ownerCenter?: unknown }>(ctx.req);
      const name = text(body.name, 60) || fail(400, "name_required", "請輸入群組名稱");
      // 總部群組只有秘書與超級管理員可建立；會長、音控只能建立自己中心的群組。
      const own = text(body.ownerCenter, 100) || null;
      if (s.role !== "admin" && !(own && canManageCenter(s, centerKey(own)))) fail(403, "forbidden", "沒有建立這個群組的權限");
      const id = `g${randomId(8)}`;
      await ctx.db.batch([
        ctx.db.prepare("INSERT INTO review_groups (id, name, owner_center_key, owner_center_label, created_by_sub) VALUES (?, ?, ?, ?, ?)").bind(id, name, own ? centerKey(own) : null, own ?? "", s.sub),
        audit(ctx.db, s.sub, "group.create", "review_group", id, name),
      ]);
      return listGroups(ctx);
    },
  ],
  [
    "PATCH",
    /^\/admin\/review-groups\/([\w-]+)$/,
    async (ctx, [id]) => {
      const s = await requireGroupManager(ctx, id);
      const name = text((await readJson<{ name?: unknown }>(ctx.req)).name, 60) || fail(400, "name_required", "請輸入群組名稱");
      await ctx.db.batch([ctx.db.prepare("UPDATE review_groups SET name = ? WHERE id = ?").bind(name, id), audit(ctx.db, s.sub, "group.rename", "review_group", id, name)]);
      return listGroups(ctx);
    },
  ],
  [
    "DELETE",
    /^\/admin\/review-groups\/([\w-]+)$/,
    async (ctx, [id]) => {
      const s = await requireGroupManager(ctx, id);
      await ctx.db.batch([
        ctx.db.prepare("UPDATE courses SET review_group_id = NULL WHERE review_group_id = ?").bind(id),
        ctx.db.prepare("DELETE FROM review_groups WHERE id = ?").bind(id),
        audit(ctx.db, s.sub, "group.delete", "review_group", id),
      ]);
      return listGroups(ctx);
    },
  ],
  [
    "POST",
    /^\/admin\/review-groups\/([\w-]+)\/members$/,
    async (ctx, [id]) => {
      const s = await requireGroupManager(ctx, id);
      const body = await readJson<{ memberSub?: unknown; duty?: unknown; center?: unknown; remove?: unknown }>(ctx.req);
      const sub = typeof body.memberSub === "string" ? body.memberSub.trim() : "";
      if (!/^[\w-]{3,128}$/.test(sub)) fail(400, "invalid_member", "請貼上正確的會員 ID（對方在「我的」頁可以看到）");
      if (body.duty !== "register" && body.duty !== "collect" && body.duty !== "review") fail(400, "invalid_duty", "請選擇職責");
      const label = text(body.center, 100) ?? "";
      const key = label ? centerKey(label) : "";
      if (body.remove === true) {
        await ctx.db.batch([
          ctx.db.prepare("DELETE FROM review_group_members WHERE group_id = ? AND center_key = ? AND member_sub = ? AND duty = ?").bind(id, key, sub, body.duty),
          audit(ctx.db, s.sub, "group.member_remove", "review_group", id, `${sub}:${body.duty}`),
        ]);
        return listGroups(ctx);
      }
      // 姓名：先用對方曾留下的報名姓名；對方下次登入時會自動更新。
      const known = await ctx.db
        .prepare("SELECT member_name AS n FROM review_group_members WHERE member_sub = ? AND member_name <> '' UNION SELECT member_name_snapshot FROM orders WHERE member_sub = ? LIMIT 1")
        .bind(sub, sub)
        .first<{ n: string }>();
      await ctx.db.batch([
        ctx.db
          .prepare("INSERT OR IGNORE INTO review_group_members (group_id, center_key, center_label, member_sub, member_name, duty, added_by_sub) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(id, key, label, sub, sub === s.sub ? s.name : (known?.n ?? ""), body.duty, s.sub),
        audit(ctx.db, s.sub, "group.member_add", "review_group", id, `${sub}:${body.duty}`),
        notify(ctx.db, { sub }, "你已被指派為課程報名審核人員", `群組：${(await ctx.db.prepare("SELECT name FROM review_groups WHERE id = ?").bind(id).first<{ name: string }>())?.name ?? ""}${label ? `｜${label}` : "｜全部中心"}`, "/admin/orders"),
      ]);
      return listGroups(ctx);
    },
  ],
  [
    "POST",
    /^\/admin\/courses\/([\w-]+)\/runs$/,
    async (ctx, [courseId]) => {
      const admin = requireAdmin(ctx);
      if (!(await ctx.db.prepare("SELECT 1 AS ok FROM courses WHERE id = ?").bind(courseId).first())) fail(404, "not_found", "找不到這門課程");
      const f = runFields(await readJson(ctx.req), true);
      const id = `r${randomId(8)}`;
      await ctx.db.batch([
        ctx.db.prepare(`INSERT INTO course_runs (id, course_id, ${f.map(([c]) => c).join(", ")}) VALUES (?, ?, ${f.map(() => "?").join(", ")})`).bind(id, courseId, ...f.map(([, v]) => v)),
        audit(ctx.db, admin.sub, "run.create", "course_run", id),
      ]);
      return courseDetail(ctx, courseId);
    },
  ],
  [
    "PATCH",
    /^\/admin\/runs\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const run = await ctx.db.prepare("SELECT course_id FROM course_runs WHERE id = ?").bind(id).first<{ course_id: string }>();
      if (!run) return fail(404, "not_found", "找不到這個場次");
      const f = runFields(await readJson(ctx.req), false);
      if (!f.length) fail(400, "nothing_to_update", "沒有要更新的欄位");
      await ctx.db.batch([ctx.db.prepare(`UPDATE course_runs SET ${f.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`).bind(...f.map(([, v]) => v), id), audit(ctx.db, admin.sub, "run.update", "course_run", id)]);
      return courseDetail(ctx, run.course_id);
    },
  ],
  [
    "GET",
    /^\/admin\/runs\/([\w-]+)\/delete-impact$/,
    async (ctx, [id]) => {
      requireAdmin(ctx);
      return runDeleteImpact(ctx.db, id);
    },
  ],
  [
    "DELETE",
    /^\/admin\/runs\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const run = await ctx.db.prepare("SELECT course_id FROM course_runs WHERE id = ?").bind(id).first<{ course_id: string }>();
      if (!run) return fail(404, "not_found", "找不到這個場次");
      const impact = await runDeleteImpact(ctx.db, id);
      if (impact.registrations === 0) {
        await ctx.db.batch([ctx.db.prepare("DELETE FROM course_runs WHERE id = ?").bind(id), audit(ctx.db, admin.sub, "run.delete", "course_run", id)]);
        return courseDetail(ctx, run.course_id);
      }
      // 已有人報名：必須輸入 YES；報名與審核紀錄、這個場次專屬的章節（含附件、音檔）與學習進度一併刪除。
      const body = (await ctx.req.json().catch(() => ({}))) as { confirm?: unknown };
      if (body.confirm !== "YES") fail(409, "confirm_required", `這個場次已有 ${impact.registrations} 筆報名紀錄；刪除需輸入 YES 確認`);
      const audio = await ctx.db.prepare("SELECT media_ref FROM lessons WHERE run_id = ? AND media_type = 'audio' AND media_ref IS NOT NULL").bind(id).all<{ media_ref: string }>();
      const files = (await ctx.db.prepare("SELECT r2_key FROM lesson_attachments WHERE r2_key IS NOT NULL AND lesson_id IN (SELECT id FROM lessons WHERE run_id = ?)").bind(id).all<{ r2_key: string }>()).results.map((r) => r.r2_key);
      const onlyThis = "id IN (SELECT order_id FROM order_items WHERE run_id = ?1) AND NOT EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = orders.id AND x.run_id <> ?1)";
      await ctx.db.batch([
        ctx.db.prepare(`DELETE FROM notifications WHERE (link LIKE '/orders/%' AND substr(link, 9) IN (SELECT id FROM orders WHERE ${onlyThis})) OR (link LIKE '/admin/orders/%' AND substr(link, 15) IN (SELECT id FROM orders WHERE ${onlyThis}))`).bind(id),
        ctx.db.prepare("DELETE FROM enrollments WHERE run_id = ?").bind(id),
        ctx.db.prepare(`DELETE FROM orders WHERE ${onlyThis}`).bind(id),
        ctx.db.prepare("UPDATE orders SET total_twd = MAX(0, total_twd - (SELECT COALESCE(SUM(price_twd), 0) FROM order_items WHERE order_id = orders.id AND run_id = ?1)) WHERE id IN (SELECT order_id FROM order_items WHERE run_id = ?1)").bind(id),
        ctx.db.prepare("DELETE FROM order_items WHERE run_id = ?").bind(id),
        ctx.db.prepare("DELETE FROM lessons WHERE run_id = ?").bind(id),
        audit(ctx.db, admin.sub, "run.delete", "course_run", id, JSON.stringify({ title: impact.title, course: impact.courseTitle, registrations: impact.registrations, students: impact.students, paidTwd: impact.paidTwd, lessons: impact.lessons })),
        ctx.db.prepare("DELETE FROM course_runs WHERE id = ?").bind(id),
      ]);
      await renumber(ctx.db, run.course_id);
      for (const k of files) await ctx.env.MEDIA?.delete(k).catch(() => undefined);
      for (const a of audio.results) await ctx.env.MEDIA?.delete(a.media_ref).catch(() => undefined);
      return courseDetail(ctx, run.course_id);
    },
  ],
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
      const files = await attachmentKeys(ctx.db, "lesson_id", id);
      await ctx.db.batch([ctx.db.prepare("DELETE FROM lessons WHERE id = ?").bind(id), audit(ctx.db, admin.sub, "lesson.delete", "lesson", id)]);
      await renumber(ctx.db, lesson.course_id);
      if (lesson.media_type === "audio" && lesson.media_ref) await ctx.env.MEDIA?.delete(lesson.media_ref).catch(() => undefined);
      for (const k of files) await ctx.env.MEDIA?.delete(k).catch(() => undefined);
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
    /^\/courses\/([\w-]+)\/lessons\/([\w-]+)\/attachments$/,
    async (ctx, [courseId, lessonId]) => {
      const lesson = await lessonOf(ctx, courseId, lessonId);
      if (!(await canWatch(ctx, courseId, lesson.run_id))) fail(403, "not_enrolled", "請先報名並通過審核");
      const { results } = await ctx.db.prepare(`SELECT ${ATTACH_COLS} FROM lesson_attachments WHERE lesson_id = ? ORDER BY created_at`).bind(lessonId).all<AttachmentRow>();
      return Promise.all(results.map((r) => attachmentOut(ctx.env, r, true)));
    },
  ],
  [
    "GET",
    /^\/admin\/lessons\/([\w-]+)\/attachments$/,
    async (ctx, [id]) => {
      requireAdmin(ctx);
      const { results } = await ctx.db.prepare(`SELECT ${ATTACH_COLS} FROM lesson_attachments WHERE lesson_id = ? ORDER BY created_at`).bind(id).all<AttachmentRow>();
      return Promise.all(results.map((r) => attachmentOut(ctx.env, r, false)));
    },
  ],
  [
    "PUT",
    /^\/admin\/lessons\/([\w-]+)\/attachments$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const bucket = ctx.env.MEDIA ?? fail(503, "storage_not_ready", "檔案儲存空間尚未啟用");
      const lesson = await ctx.db.prepare("SELECT course_id FROM lessons WHERE id = ?").bind(id).first<{ course_id: string }>();
      if (!lesson) return fail(404, "not_found", "找不到這個章節");
      const name = (ctx.url.searchParams.get("name") ?? "").replace(/[\\/\u0000-\u001f]/g, "").trim().slice(0, 120);
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? "").toLowerCase();
      const type = ATTACH_TYPES[ext];
      if (!name || !type) fail(400, "invalid_file", "不支援這種檔案；可上傳 PDF、Word、PowerPoint、Excel、CSV、文字、ZIP、PNG、JPG");
      const declared = Number(ctx.req.headers.get("content-length") ?? 0);
      if (declared > ATTACH_MAX) fail(413, "too_large", "附件大小需在 50MB 以內");
      const count = await ctx.db.prepare("SELECT COUNT(*) AS n FROM lesson_attachments WHERE lesson_id = ?").bind(id).first<{ n: number }>();
      if ((count?.n ?? 0) >= ATTACH_PER_LESSON) fail(409, "too_many", `每個章節最多 ${ATTACH_PER_LESSON} 個附件`);
      const data = await ctx.req.arrayBuffer();
      if (!data.byteLength) fail(400, "empty_file", "檔案是空的");
      if (data.byteLength > ATTACH_MAX) fail(413, "too_large", "附件大小需在 50MB 以內");
      const key = `files/${id}/${crypto.randomUUID()}.${ext}`;
      await bucket.put(key, data, { httpMetadata: { contentType: type } });
      const attId = crypto.randomUUID();
      const attType = ATTACH_KIND[ext] ?? "file";
      const title = cleanTitle(ctx.url.searchParams.get("title")) || name;
      await ctx.db.batch([
        ctx.db.prepare("INSERT INTO lesson_attachments (id, lesson_id, course_id, name, r2_key, size, content_type, kind, att_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'file', ?, ?)").bind(attId, id, lesson.course_id, title, key, data.byteLength, type, attType, admin.sub),
        audit(ctx.db, admin.sub, "lesson.attachment_add", "lesson", id, attId),
      ]);
      return { id: attId, name: title, kind: "file", type: attType, size: data.byteLength } satisfies Attachment;
    },
  ],
  [
    "DELETE",
    /^\/admin\/attachments\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const row = await ctx.db.prepare("SELECT r2_key, lesson_id FROM lesson_attachments WHERE id = ?").bind(id).first<{ r2_key: string | null; lesson_id: string }>();
      if (!row) return fail(404, "not_found", "找不到這個附件");
      await ctx.db.batch([ctx.db.prepare("DELETE FROM lesson_attachments WHERE id = ?").bind(id), audit(ctx.db, admin.sub, "lesson.attachment_delete", "lesson", row.lesson_id, id)]);
      if (row.r2_key) await ctx.env.MEDIA?.delete(row.r2_key).catch(() => undefined);
      return { ok: true };
    },
  ],
  [
    "POST",
    /^\/admin\/lessons\/([\w-]+)\/links$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const lesson = await ctx.db.prepare("SELECT course_id FROM lessons WHERE id = ?").bind(id).first<{ course_id: string }>();
      if (!lesson) return fail(404, "not_found", "找不到這個章節");
      const body = await readJson<{ url?: unknown; title?: unknown }>(ctx.req);
      const u = parseHttpsUrl(body.url);
      if (!u) return fail(400, "invalid_url", "請輸入 https 開頭的有效網址");
      const count = await ctx.db.prepare("SELECT COUNT(*) AS n FROM lesson_attachments WHERE lesson_id = ?").bind(id).first<{ n: number }>();
      if ((count?.n ?? 0) >= ATTACH_PER_LESSON) return fail(409, "too_many", `每個章節最多 ${ATTACH_PER_LESSON} 個附件`);
      const type = classifyLink(u);
      const title = cleanTitle(body.title) || LINK_DEFAULT_TITLE[type];
      const attId = crypto.randomUUID();
      await ctx.db.batch([
        ctx.db.prepare("INSERT INTO lesson_attachments (id, lesson_id, course_id, name, kind, link_url, att_type, created_by) VALUES (?, ?, ?, ?, 'link', ?, ?, ?)").bind(attId, id, lesson.course_id, title, u.toString(), type, admin.sub),
        audit(ctx.db, admin.sub, "lesson.link_add", "lesson", id, attId),
      ]);
      return { id: attId, name: title, kind: "link", type, size: 0, url: u.toString() } satisfies Attachment;
    },
  ],
  [
    "PATCH",
    /^\/admin\/attachments\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const row = await ctx.db.prepare("SELECT kind, lesson_id FROM lesson_attachments WHERE id = ?").bind(id).first<{ kind: string; lesson_id: string }>();
      if (!row) return fail(404, "not_found", "找不到這個附件");
      const body = await readJson<{ title?: unknown; url?: unknown }>(ctx.req);
      const title = cleanTitle(body.title);
      if (!title) return fail(400, "title_required", "請輸入顯示標題");
      let url: URL | null = null;
      if (body.url !== undefined) {
        if (row.kind !== "link") return fail(400, "not_link", "只有網址附件可以修改網址");
        url = parseHttpsUrl(body.url);
        if (!url) return fail(400, "invalid_url", "請輸入 https 開頭的有效網址");
      }
      await ctx.db.batch([
        url
          ? ctx.db.prepare("UPDATE lesson_attachments SET name = ?, link_url = ?, att_type = ? WHERE id = ?").bind(title, url.toString(), classifyLink(url), id)
          : ctx.db.prepare("UPDATE lesson_attachments SET name = ? WHERE id = ?").bind(title, id),
        audit(ctx.db, admin.sub, "lesson.attachment_edit", "lesson", row.lesson_id, id),
      ]);
      return { ok: true };
    },
  ],
  [
    "GET",
    /^\/media\/pub$/,
    async (ctx) => {
      // 課程封面與 EDM 是公開圖片（課程列表本來就要顯示；EDM 開放下載）。只服務資料庫裡仍在使用的檔案。
      const key = ctx.url.searchParams.get("k") ?? "";
      const bucket = ctx.env.MEDIA;
      if (!bucket || !/^(edm|cover)\/[\w-]+\/[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });
      const used = await ctx.db.prepare("SELECT 1 AS ok FROM courses WHERE edm_key = ? OR cover_key = ?").bind(key, key).first();
      const obj = used ? await bucket.get(key) : null;
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: { "content-type": obj.httpMetadata?.contentType ?? "image/jpeg", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
      });
    },
  ],
  [
    "GET",
    /^\/media\/img$/,
    async (ctx) => {
      // 底圖圖庫：簽名網址即授權（只有課程編輯人員拿得到）。
      const key = await verifyImgUrl(ctx.env, ctx.url);
      const obj = key && ctx.env.MEDIA ? await ctx.env.MEDIA.get(key) : null;
      if (!key) return new Response("Forbidden", { status: 403 });
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType ?? "image/jpeg", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
    },
  ],
  [
    "GET",
    /^\/admin\/cover-backgrounds$/,
    async (ctx) => {
      const s = requireMember(ctx);
      if (!canUseGallery(s)) fail(403, "forbidden", "需要課程編輯權限");
      const { results } = await ctx.db
        .prepare("SELECT b.id, b.r2_key, b.uploader_name, b.uploader_center, b.builtin, b.hidden, EXISTS (SELECT 1 FROM courses c WHERE c.cover_bg_id = b.id) AS in_use FROM cover_backgrounds b ORDER BY b.builtin DESC, b.created_at DESC")
        .all<{ id: string; r2_key: string; uploader_name: string; uploader_center: string; builtin: number; hidden: number; in_use: number }>();
      const out: CoverBackground[] = [];
      for (const r of results) {
        if (r.hidden && s.role !== "admin") continue;
        out.push({ id: r.id, url: (await imgUrl(ctx.env, r.r2_key)) ?? "", uploaderName: r.uploader_name, uploaderCenter: r.uploader_center, builtin: r.builtin === 1, hidden: r.hidden === 1, inUse: r.in_use === 1 });
      }
      return out;
    },
  ],
  [
    "PUT",
    /^\/admin\/cover-backgrounds$/,
    async (ctx) => {
      const s = requireMember(ctx);
      if (!canUseGallery(s)) fail(403, "forbidden", "需要課程編輯權限");
      const bucket = ctx.env.MEDIA ?? fail(503, "storage_not_ready", "圖片儲存空間尚未啟用");
      const data = new Uint8Array(await ctx.req.arrayBuffer());
      if (!data.byteLength || data.byteLength > 3 * 1024 * 1024) fail(413, "invalid_size", "底圖大小需在 3MB 以內（上傳時會自動壓縮）");
      const img = sniffImage(data) ?? fail(400, "invalid_image", "請上傳 JPG、PNG 或 WebP 圖片");
      const id = crypto.randomUUID();
      const key = `bg/${id}.${img.ext}`;
      await bucket.put(key, data.buffer as ArrayBuffer, { httpMetadata: { contentType: img.type } });
      await ctx.db.batch([
        ctx.db.prepare("INSERT INTO cover_backgrounds (id, r2_key, uploader_sub, uploader_name, uploader_center) VALUES (?, ?, ?, ?, ?)").bind(id, key, s.sub, s.name, s.center?.label ?? ""),
        audit(ctx.db, s.sub, "cover_bg.upload", "cover_bg", id),
      ]);
      return { id, url: (await imgUrl(ctx.env, key)) ?? "", uploaderName: s.name, uploaderCenter: s.center?.label ?? "", builtin: false, hidden: false, inUse: false } satisfies CoverBackground;
    },
  ],
  [
    "PATCH",
    /^\/admin\/cover-backgrounds\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const body = await readJson<{ hidden?: unknown }>(ctx.req);
      if (typeof body.hidden !== "boolean") fail(400, "invalid_request", "參數不正確");
      const r = await ctx.db.prepare("UPDATE cover_backgrounds SET hidden = ? WHERE id = ?").bind(body.hidden ? 1 : 0, id).run();
      if (r.meta?.changes === 0) fail(404, "not_found", "找不到這張底圖");
      await audit(ctx.db, admin.sub, body.hidden ? "cover_bg.hide" : "cover_bg.show", "cover_bg", id).run();
      return { ok: true };
    },
  ],
  [
    "DELETE",
    /^\/admin\/cover-backgrounds\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const row = await ctx.db.prepare("SELECT r2_key, builtin FROM cover_backgrounds WHERE id = ?").bind(id).first<{ r2_key: string; builtin: number }>();
      if (!row) return fail(404, "not_found", "找不到這張底圖");
      if (row.builtin) fail(409, "builtin", "內建底圖不能刪除，只能隱藏");
      if (await ctx.db.prepare("SELECT 1 AS ok FROM courses WHERE cover_bg_id = ?").bind(id).first()) fail(409, "in_use", "這張底圖正被課程封面使用，不能刪除，只能隱藏");
      await ctx.db.batch([ctx.db.prepare("DELETE FROM cover_backgrounds WHERE id = ?").bind(id), audit(ctx.db, admin.sub, "cover_bg.delete", "cover_bg", id)]);
      await ctx.env.MEDIA?.delete(row.r2_key).catch(() => undefined);
      return { ok: true };
    },
  ],
  [
    "PUT",
    /^\/admin\/courses\/([\w-]+)\/(edm|cover)$/,
    async (ctx, [id, part]) => {
      const s = requireMember(ctx);
      await requireCourseArt(ctx, s, id);
      const bucket = ctx.env.MEDIA ?? fail(503, "storage_not_ready", "圖片儲存空間尚未啟用");
      const data = new Uint8Array(await ctx.req.arrayBuffer());
      const max = part === "edm" ? 8 * 1024 * 1024 : 3 * 1024 * 1024;
      if (!data.byteLength || data.byteLength > max) fail(413, "invalid_size", `圖片大小需在 ${max / 1024 / 1024}MB 以內（上傳時會自動壓縮）`);
      const img = sniffImage(data) ?? fail(400, "invalid_image", "請上傳 JPG、PNG 或 WebP 圖片");
      let bgId: string | null = null;
      if (part === "cover") {
        const q = ctx.url.searchParams.get("bg");
        if (q) {
          if (!(await ctx.db.prepare("SELECT 1 AS ok FROM cover_backgrounds WHERE id = ?").bind(q).first())) fail(400, "invalid_bg", "找不到這張底圖");
          bgId = q;
        }
      }
      const col = part === "edm" ? "edm_key" : "cover_key";
      const old = await ctx.db.prepare(`SELECT ${col} AS k FROM courses WHERE id = ?`).bind(id).first<{ k: string | null }>();
      const key = `${part}/${id}/${crypto.randomUUID()}.${img.ext}`;
      await bucket.put(key, data.buffer as ArrayBuffer, { httpMetadata: { contentType: img.type } });
      await ctx.db.batch([
        part === "edm"
          ? ctx.db.prepare("UPDATE courses SET edm_key = ?, art_version = art_version + 1 WHERE id = ?").bind(key, id)
          : ctx.db.prepare("UPDATE courses SET cover_key = ?, cover_bg_id = ?, art_version = art_version + 1 WHERE id = ?").bind(key, bgId, id),
        audit(ctx.db, s.sub, `course.${part}_upload`, "course", id, key),
      ]);
      if (old?.k) await bucket.delete(old.k).catch(() => undefined);
      return { ok: true, url: pubUrl(key, 0) };
    },
  ],
  [
    "DELETE",
    /^\/admin\/courses\/([\w-]+)\/(edm|cover)$/,
    async (ctx, [id, part]) => {
      const s = requireMember(ctx);
      await requireCourseArt(ctx, s, id);
      const col = part === "edm" ? "edm_key" : "cover_key";
      const old = await ctx.db.prepare(`SELECT ${col} AS k FROM courses WHERE id = ?`).bind(id).first<{ k: string | null }>();
      await ctx.db.batch([
        part === "edm" ? ctx.db.prepare("UPDATE courses SET edm_key = NULL, art_version = art_version + 1 WHERE id = ?").bind(id) : ctx.db.prepare("UPDATE courses SET cover_key = NULL, cover_bg_id = NULL, art_version = art_version + 1 WHERE id = ?").bind(id),
        audit(ctx.db, s.sub, `course.${part}_remove`, "course", id),
      ]);
      if (old?.k) await ctx.env.MEDIA?.delete(old.k).catch(() => undefined);
      return { ok: true };
    },
  ],
  [
    "GET",
    /^\/media\/file$/,
    async (ctx) => {
      // 簽名網址即授權（瀏覽器下載無法帶 Authorization 標頭）；檔名取自資料表，一律以附件下載。
      const key = await verifyFileUrl(ctx.env, ctx.url);
      const bucket = ctx.env.MEDIA;
      if (!key || !bucket) return new Response("Forbidden", { status: 403 });
      const meta = await ctx.db.prepare("SELECT name, content_type FROM lesson_attachments WHERE r2_key = ?").bind(key).first<{ name: string; content_type: string }>();
      const obj = meta ? await bucket.get(key) : null;
      if (!meta || !obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "content-type": meta.content_type,
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
          "x-content-type-options": "nosniff",
          "cache-control": "private, max-age=600",
        },
      });
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
    "GET",
    /^\/admin\/courses\/([\w-]+)\/delete-impact$/,
    async (ctx, [id]) => {
      requireAdmin(ctx);
      return courseDeleteImpact(ctx.db, id);
    },
  ],
  [
    "DELETE",
    /^\/admin\/courses\/([\w-]+)$/,
    async (ctx, [id]) => {
      const admin = requireAdmin(ctx);
      const impact = await courseDeleteImpact(ctx.db, id);
      const body = (await ctx.req.json().catch(() => ({}))) as { confirm?: unknown };
      // 已有人報名：必須明確輸入 YES 才能刪除，且報名紀錄、審核紀錄與學習進度會一併刪除。
      if (impact.registrations > 0 && body.confirm !== "YES") fail(409, "confirm_required", `這門課程已有 ${impact.registrations} 筆報名紀錄；刪除需輸入 YES 確認`);
      const audio = await ctx.db.prepare("SELECT media_ref FROM lessons WHERE course_id = ? AND media_type = 'audio' AND media_ref IS NOT NULL").bind(id).all<{ media_ref: string }>();
      const files = await attachmentKeys(ctx.db, "course_id", id);
      const art = await ctx.db.prepare("SELECT edm_key, cover_key FROM courses WHERE id = ?").bind(id).first<{ edm_key: string | null; cover_key: string | null }>();
      // 只含這門課的報名紀錄整筆刪除；同時報名多門課的紀錄只移除這門課並扣掉金額。
      const onlyThis = "id IN (SELECT order_id FROM order_items WHERE course_id = ?1) AND NOT EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = orders.id AND x.course_id <> ?1)";
      const [, , , , , , res] = await ctx.db.batch([
        ctx.db.prepare(`DELETE FROM notifications WHERE (link LIKE '/orders/%' AND substr(link, 9) IN (SELECT id FROM orders WHERE ${onlyThis})) OR (link LIKE '/admin/orders/%' AND substr(link, 15) IN (SELECT id FROM orders WHERE ${onlyThis}))`).bind(id),
        ctx.db.prepare("DELETE FROM enrollments WHERE course_id = ?").bind(id),
        ctx.db.prepare(`DELETE FROM orders WHERE ${onlyThis}`).bind(id),
        ctx.db.prepare("UPDATE orders SET total_twd = MAX(0, total_twd - (SELECT COALESCE(SUM(price_twd), 0) FROM order_items WHERE order_id = orders.id AND course_id = ?1)) WHERE id IN (SELECT order_id FROM order_items WHERE course_id = ?1)").bind(id),
        ctx.db.prepare("DELETE FROM order_items WHERE course_id = ?").bind(id),
        audit(ctx.db, admin.sub, "course.delete", "course", id, JSON.stringify({ title: impact.title, registrations: impact.registrations, students: impact.students, paidTwd: impact.paidTwd })),
        ctx.db.prepare("DELETE FROM courses WHERE id = ?").bind(id),
      ]);
      if (res.meta?.changes === 0) fail(404, "not_found", "找不到這門課程");
      for (const k of [...files, art?.edm_key, art?.cover_key]) if (k) await ctx.env.MEDIA?.delete(k).catch(() => undefined);
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
export async function handleApi(req: Request, env: Env, exec?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
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
  // 有寫入動作時，把新產生的站內通知也寄成 Email（背景處理，失敗不影響回應）。
  if (req.method !== "GET" && res.status < 400 && env.EMAIL) {
    const job = flushEmails(env).catch((e) => console.error("flush emails", e instanceof Error ? e.message : "error"));
    if (exec) exec.waitUntil(job);
    else await job;
  }
  return res;
}

async function context(req: Request, env: Env, url: URL): Promise<Ctx> {
  return { env, db: env.DB, req, url, platform: platformOf(req), session: await loadSession(env, req) };
}
