/**
 * 中央會員串接（https://id.hglobal1985.com）：
 * - 驗證 Access Token（RS256、typ=at+jwt、iss/aud、app_id=learn、exp），會員主鍵只用 sub。
 * - 獎銜資格一律即時向中央查詢（fail closed），結果只放記憶體快取，不寫入資料庫或日誌。
 * - 管理員 = 中央「超級管理員」（以 /v1/apps/learn/handoff 確認，這是中央唯一接受 App 登入的職務查詢），
 *   或列在 LEARN_ADMIN_SUBS 的會員 ID。
 * 日誌不得出現 Token、信箱、姓名。
 */
export const CENTRAL = "https://id.hglobal1985.com";
export const APP_ID = "learn";

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
let centralFetch: Fetch = (input, init) => fetch(input, init);
/** 測試用：替換對中央的網路請求。 */
export function setCentralFetch(f: Fetch): void {
  centralFetch = f;
  keys.clear();
  memo.clear();
}

type Claims = { sub: string; iss: string; aud: string; app_id: string; exp: number; nbf?: number };
const keys = new Map<string, { key: CryptoKey; until: number }>();
let loading: Promise<void> | null = null;

const b64urlBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
};
const b64urlJson = (s: string): unknown => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function loadKeys(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const res = await centralFetch(`${CENTRAL}/oauth/jwks`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw Error("jwks_unavailable");
    const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string; use?: string })[] };
    const found: { kid: string; key: CryptoKey }[] = [];
    for (const jwk of body.keys ?? []) {
      if (jwk.kty !== "RSA" || !jwk.kid || (jwk.use && jwk.use !== "sig") || (jwk.alg && jwk.alg !== "RS256")) continue;
      found.push({ kid: jwk.kid, key: await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]) });
    }
    if (!found.length) throw Error("empty_jwks");
    keys.clear();
    for (const f of found) keys.set(f.kid, { key: f.key, until: Date.now() + 600_000 });
  })();
  try {
    await loading;
  } finally {
    loading = null;
  }
}

export const looksLikeJwt = (token: string) => /^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token);

export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    if (token.length > 8192 || !looksLikeJwt(token)) return null;
    const [h, p, s] = token.split(".");
    const header = b64urlJson(h) as { alg?: string; typ?: string; kid?: string };
    if (header.alg !== "RS256" || header.typ !== "at+jwt" || !header.kid) return null;
    let entry = keys.get(header.kid);
    if (!entry || entry.until <= Date.now()) {
      await loadKeys();
      entry = keys.get(header.kid);
    }
    if (!entry) return null;
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", entry.key, b64urlBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const c = b64urlJson(p) as Claims;
    const now = Math.floor(Date.now() / 1000);
    if (c.iss !== CENTRAL || c.aud !== CENTRAL || c.app_id !== APP_ID) return null;
    if (typeof c.sub !== "string" || !c.sub || c.sub.length > 128) return null;
    if (typeof c.exp !== "number" || c.exp <= now || (c.nbf && c.nbf > now)) return null;
    return c.sub;
  } catch {
    return null;
  }
}

/** 短時效記憶體快取（只在單一 Worker 執行個體內，不落地）。 */
const memo = new Map<string, { value: unknown; until: number }>();
const inflight = new Map<string, Promise<unknown>>();
/** 查詢結果短暫放記憶體；同一時間同樣的查詢只送一次（同一個請求裡好幾個地方都要同一份資料時，不會重複問會員中心）；查不到（undefined）不快取。 */
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.value as T;
  const running = inflight.get(key);
  if (running) return (await running) as T;
  const p = (async () => {
    const value = await load();
    if (value !== undefined) {
      memo.set(key, { value, until: Date.now() + ttlMs });
      if (memo.size > 2000) memo.delete(memo.keys().next().value!);
    }
    return value;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

async function callCentral(token: string, path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await centralFetch(`${CENTRAL}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
}

/** 顯示名稱與頭像網址（頭像在會員中心本來就是公開的；只放記憶體快取，不寫入資料庫）。不是 Amway 資料。 */
type ProfileDoc = { fields?: Record<string, { value?: unknown }>; avatar?: { url?: unknown } };
/** GET /v1/me/profile 只打一次（名稱、頭像、聯絡信箱、真實姓名共用；放記憶體 2 分鐘）。查不到回 undefined。 */
async function profileDoc(sub: string, token: string): Promise<ProfileDoc | undefined> {
  return cached(`pdoc:${sub}`, 120_000, async () => {
    const res = await callCentral(token, "/v1/me/profile");
    if (!res?.ok) return undefined;
    const b = (await res.json().catch(() => null)) as ProfileDoc | null;
    return b?.fields ? b : undefined;
  });
}

export async function profileSummary(sub: string, token: string): Promise<{ name: string; avatarUrl: string | null }> {
  const body = await profileDoc(sub, token);
  if (!body) return { name: "會員", avatarUrl: null };
  const v = body.fields?.display_name?.value;
  const a = typeof body.avatar?.url === "string" ? body.avatar.url : "";
  const avatarUrl = a.startsWith("/") ? `${CENTRAL}${a}` : /^https:\/\//.test(a) ? a : null;
  return { name: typeof v === "string" && v.trim() ? v.trim().slice(0, 50) : "會員", avatarUrl };
}

/** 會員在會員中心的獎銜（只放記憶體快取供首頁顯示，不寫入資料庫；業主 2026-11-12 授權讀取）。查不到回 undefined。 */
type AmwayMe = { enabled?: boolean; hglobal_systems?: string[]; fields?: Record<string, { value?: unknown; pending_value?: unknown }> };
/** GET /v1/me/amway 只打一次（獎銜顯示與資料補填提醒共用；放記憶體 2 分鐘）。 */
export async function amwayMe(sub: string, token: string): Promise<AmwayMe | undefined> {
  return cached(`amway:${sub}`, 120_000, async () => {
    const res = await callCentral(token, "/v1/me/amway");
    if (!res?.ok) return undefined;
    return ((await res.json().catch(() => null)) as AmwayMe | null) ?? undefined;
  });
}

export async function rankValue(sub: string, token: string): Promise<string | null | undefined> {
  return (async () => {
    const b = await amwayMe(sub, token);
    if (!b) return undefined;
    const v = b.fields?.rank?.value;
    const s = typeof v === "string" ? v : v && typeof v === "object" && typeof (v as { option?: unknown }).option === "string" ? (v as { option: string }).option : null;
    return s && s.trim() ? s.trim() : null;
  })();
}

/** 會員本人在會員中心的「真實姓名」（legal_name）。每次即時讀取、不快取；查不到或空白回 ""。 */
export async function legalNameOf(token: string): Promise<string> {
  const res = await callCentral(token, "/v1/me/profile");
  if (!res?.ok) return "";
  const b = (await res.json().catch(() => null)) as { fields?: Record<string, { value?: unknown }> } | null;
  const v = b?.fields?.legal_name?.value;
  return typeof v === "string" ? v.trim().slice(0, 50) : "";
}

/** 會員中心資料是否完整（只回「缺什麼」的名稱，不保存任何值）：聯絡信箱；勾選「我是 Amway 會員」時，Amway 欄位有沒有空白。 */
export async function profileGaps(sub: string, token: string, email: string | null | undefined): Promise<string[]> {
  return cached(`gaps:${sub}:${email ? 1 : 0}`, 60_000, async () => {
    const gaps: string[] = [];
    // Email 不列入提醒：會員用 Google 登入，信箱由會員中心預設帶入 Google 信箱（見交接文件）。
    void email;
    {
      const b = await amwayMe(sub, token);
      if (b?.enabled) {
        // 只檢查核心三欄（培訓系統、地區教育中心、獎銜）；推薦人與各上手因人而異（可能沒有），不列入提醒。
        const core = ["education_system", "education_center", "rank"];
        const empty = core.some((k) => {
          const f = b.fields?.[k];
          return !f || ((f.value == null || f.value === "") && (f.pending_value == null || f.pending_value === ""));
        });
        if (empty) gaps.push("Amway 會員資料");
      }
    }
    return gaps;
  });
}

/** 獎銜選項（代碼→名稱）：向中央 GET /v1/amway/field-definitions 讀取 key=rank 的 options，不寫死；快取 1 天、只放記憶體。讀不到回空 Map。 */
export async function rankOptions(token: string): Promise<Map<string, string>> {
  return cached("rank-options", 86_400_000, async () => {
    const out = new Map<string, string>();
    const res = await callCentral(token, "/v1/amway/field-definitions");
    if (!res?.ok) return out;
    const b = (await res.json().catch(() => null)) as unknown;
    const list: unknown[] = Array.isArray(b) ? b : b && typeof b === "object" ? Object.values((b as { fields?: unknown }).fields ?? b) : [];
    const rank = list.find((f) => f && typeof f === "object" && (f as { key?: unknown }).key === "rank") as { options?: { value?: unknown; label?: unknown }[] } | undefined;
    for (const o of rank?.options ?? []) if (typeof o.value === "string" && typeof o.label === "string") out.set(o.value, o.label);
    return out;
  });
}

/** 顯示名稱（供訂單審核辨識）。 */
export async function displayName(sub: string, token: string): Promise<string> {
  return (await profileSummary(sub, token)).name;
}

/**
 * 是否為本 App 管理員。中央的 /v1/admin/* 只接受會員中心網站本身的登入，App 的 token 一律被拒；
 * 中央提供給 App 的方式是 GET /v1/apps/learn/handoff：只有超級管理員會得到 200（不帶 integrated 參數時不寫入任何紀錄）。
 * 另可在 Worker 變數 LEARN_ADMIN_SUBS（逗號分隔的會員 ID）指定其他管理員。查不到一律否。
 */
export async function isAdmin(sub: string, token: string, extraAdmins = ""): Promise<boolean> {
  // 超級管理員、總部秘書由 memberContext 的職務判斷，不再每個請求多問一次會員中心；這裡只看 LEARN_ADMIN_SUBS。
  void token;
  return extraAdmins.split(",").map((x) => x.trim()).filter(Boolean).includes(sub);
}

/** 獎銜資格（批次）：min_rank 為 none 的課程只需登入；其餘向中央查詢，失敗一律不符合。 */
export async function rankEligibility(sub: string, token: string, minRanks: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const need = [...new Set(minRanks.filter((r) => r !== "none"))];
  for (const r of minRanks) if (r === "none") out.set(r, true);
  if (!need.length) return out;
  const missing = need.filter((r) => {
    const hit = memo.get(`elig:${sub}:${r}`);
    if (hit && hit.until > Date.now()) {
      out.set(r, hit.value as boolean);
      return false;
    }
    return true;
  });
  if (!missing.length) return out;
  const res = await callCentral(token, "/v1/eligibility/check-batch", {
    method: "POST",
    body: JSON.stringify({ rules: missing.map((min_rank) => ({ audience: "hglobal_verified", min_rank })) }),
  });
  let results: { allowed?: unknown }[] = [];
  if (res?.ok) {
    const body = (await res.json().catch(() => null)) as { results?: { allowed?: unknown }[] } | null;
    results = Array.isArray(body?.results) ? body!.results : [];
  }
  missing.forEach((r, i) => {
    const allowed = results[i]?.allowed === true;
    out.set(r, allowed);
    // 只快取成功的結果 10 分鐘（規範上限 1 日）；失敗不快取，下次重試。
    if (res?.ok) memo.set(`elig:${sub}:${r}`, { value: allowed, until: Date.now() + 600_000 });
  });
  return out;
}

export type MemberContext = { roles: string[]; hglobal: boolean; center: { key: string; label: string } | null };
const NO_CONTEXT: MemberContext = { roles: [], hglobal: false, center: null };

/** 與會員中心相同的中心比對鍵（normTerm）。 */
export const centerKey = (label: string) => label.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

/** 登入者自己的職務、是否為已驗證的寰宇、已核准的中心（GET /v1/eligibility/context）。查不到一律視為沒有。 */
export async function memberContext(sub: string, token: string): Promise<MemberContext> {
  return cached(`ctx:${sub}`, 60_000, async () => {
    const res = await callCentral(token, "/v1/eligibility/context");
    if (!res?.ok) return NO_CONTEXT;
    const b = (await res.json().catch(() => null)) as { member_id?: string; roles?: { role?: string }[]; hglobal_verified?: boolean; center?: { key?: string; label?: string } | null } | null;
    if (!b || b.member_id !== sub) return NO_CONTEXT;
    const label = typeof b.center?.label === "string" ? b.center.label.trim().slice(0, 100) : "";
    return {
      roles: (b.roles ?? []).map((r) => String(r.role ?? "")).filter(Boolean),
      hglobal: b.hglobal_verified === true,
      center: label ? { key: typeof b.center?.key === "string" && b.center.key ? b.center.key : centerKey(label), label } : null,
    };
  });
}

let lastCenters: string[] = [];
/**
 * 中心清單：**唯一的正本是會員中心**（地區教育中心詞庫）。行動大學不可自行新增、也不可把本地資料（報名紀錄、審核群組…）裡出現過的名稱混進來。
 * 查不到時回傳「最近一次成功取得的清單」（還沒成功過就是空陣列）；失敗不快取。
 */
export async function centerList(token: string): Promise<string[]> {
  const fresh = await cached("centers", 300_000, async (): Promise<string[] | undefined> => {
    const res = await callCentral(token, "/v1/vocab/suggestions?pool=education_center&q=");
    if (!res?.ok) return undefined; // 失敗不放進快取
    const b = (await res.json().catch(() => null)) as { suggestions?: unknown[] } | null;
    const list = (b?.suggestions ?? []).filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 300);
    return list.length ? list : undefined;
  });
  if (fresh && fresh.length) lastCenters = fresh;
  return lastCenters;
}

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,255}\.[^\s@<>"',;]{2,63}$/;
export const validEmail = (s: string) => s.length <= 254 && EMAIL_RE.test(s);

/**
 * 登入者在會員中心的「聯絡信箱」（個人資料欄位 contact_email，正本在中央）。
 * 回傳 undefined＝查不到（中央無回應等），呼叫端不可因此清除已存的副本。
 */
export async function contactEmail(sub: string, token: string): Promise<string | null | undefined> {
  const body = await profileDoc(sub, token);
  if (!body) return undefined;
  const v = body.fields?.contact_email?.value;
  return typeof v === "string" && validEmail(v.trim()) ? v.trim().toLowerCase() : null;
}

/** 把聯絡信箱寫回會員中心（null＝清除）。成功才回 true。 */
export async function saveContactEmail(sub: string, token: string, email: string | null): Promise<boolean> {
  const res = await callCentral(token, "/v1/me/profile/fields/contact_email", { method: "PUT", body: JSON.stringify({ value: email }) });
  if (!res?.ok) return false;
  forgetMember(sub);
  return true;
}

/** 寫入或查詢後，丟掉這位會員在記憶體裡的中央資料快取（下一次讀取會拿到最新的）。 */
export function forgetMember(sub: string): void {
  for (const k of [...memo.keys()]) if (k.includes(`:${sub}`)) memo.delete(k);
}

export type RankOption = { value: string; label: string };
/** 獎銜選項清單（依階梯順序）；快取 1 天。 */
export async function rankOptionList(token: string): Promise<RankOption[]> {
  return cached("rank-option-list", 86_400_000, async () => {
    const res = await callCentral(token, "/v1/amway/field-definitions");
    if (!res?.ok) return [];
    const b = (await res.json().catch(() => null)) as unknown;
    const list: unknown[] = Array.isArray(b) ? b : b && typeof b === "object" ? Object.values((b as { fields?: unknown }).fields ?? b) : [];
    const rank = list.find((f) => f && typeof f === "object" && (f as { key?: unknown }).key === "rank") as { options?: { value?: unknown; label?: unknown }[] } | undefined;
    return (rank?.options ?? []).filter((o): o is RankOption => typeof o.value === "string" && typeof o.label === "string");
  });
}

export type AmwayFieldView = { value: string; pending: string | null; status: string };
export type CentralProfileView = { legalName: string; nickname: string; email: string; enabled: boolean; hglobal: boolean; hglobalSystems: string[]; fields: Record<"education_system" | "education_center" | "rank", AmwayFieldView>; rankOptions: RankOption[] };
const textOf = (v: unknown): string => (typeof v === "string" ? v : v && typeof v === "object" && typeof (v as { option?: unknown }).option === "string" ? (v as { option: string }).option : "");

/** 資料補填視窗要顯示的欄位（即時讀取、不快取、不保存）：真實姓名、培訓系統、地區教育中心、獎銜。 */
export async function centralProfileView(sub: string, token: string): Promise<CentralProfileView | null> {
  const [p, a0, opts] = await Promise.all([profileDoc(sub, token), amwayMe(sub, token), rankOptionList(token)]);
  const a = a0 as { enabled?: boolean; hglobal?: boolean; hglobal_systems?: string[]; fields?: Record<string, { value?: unknown; pending_value?: unknown; status?: string }> } | undefined;
  if (!p || !a) return null;
  const f = (k: string): AmwayFieldView => ({ value: textOf(a.fields?.[k]?.value), pending: a.fields?.[k]?.pending_value != null ? textOf(a.fields[k].pending_value) : null, status: a.fields?.[k]?.status ?? "not_required" });
  const em = p.fields?.contact_email?.value;
  const nn = p.fields?.display_name?.value;
  return { legalName: typeof p.fields?.legal_name?.value === "string" ? p.fields.legal_name.value : "", nickname: typeof nn === "string" ? nn : "", email: typeof em === "string" ? em.trim() : "", enabled: a.enabled === true, hglobal: a.hglobal === true, hglobalSystems: Array.isArray(a.hglobal_systems) ? a.hglobal_systems.filter((x): x is string => typeof x === "string") : [], fields: { education_system: f("education_system"), education_center: f("education_center"), rank: f("rank") }, rankOptions: opts };
}

/** 把一個欄位寫回會員中心（用會員本人的 token）。失敗時回中央的錯誤訊息。 */
export async function centralWriteField(token: string, key: "legal_name" | "display_name" | "education_system" | "education_center" | "rank", value: string | null): Promise<{ ok: true; status: string | null } | { ok: false; status: number; message: string }> {
  const path = key === "legal_name" || key === "display_name" ? `/v1/me/profile/fields/${key}` : `/v1/me/amway/fields/${key}`;
  const res = await callCentral(token, path, { method: "PUT", body: JSON.stringify({ value }) });
  if (!res) return { ok: false, status: 502, message: "會員中心暫時無法連線，請稍後再試" };
  const b = (await res.json().catch(() => null)) as { status?: string; error?: { message?: string } } | null;
  if (!res.ok) return { ok: false, status: res.status === 403 ? 403 : res.status === 422 ? 422 : 502, message: b?.error?.message ?? "會員中心拒絕了這次修改" };
  return { ok: true, status: b?.status ?? null };
}

/** 關聯詞建議（培訓系統、地區教育中心、職稱）。職稱不強迫選，只是建議，會員可自己輸入。 */
export async function centralSuggest(token: string, pool: "education_system" | "education_center" | "job_title", q: string): Promise<string[]> {
  const res = await callCentral(token, `/v1/vocab/suggestions?pool=${pool}&q=${encodeURIComponent(q.slice(0, 30))}`);
  if (!res?.ok) return [];
  const b = (await res.json().catch(() => null)) as { suggestions?: unknown[] } | null;
  return (b?.suggestions ?? []).filter((x): x is string => typeof x === "string").slice(0, q.trim() ? 12 : 100);
}

// ---------- 中央新標準（2026-11-12.10）：webhook 驗簽、服務金鑰查信箱、版本回報 ----------

/** 這份程式採用的中央串接指令版本，以及已做到的平台標準（least_scope 由業主在中央後台勾選，不在程式內宣稱）。 */
export const INTEGRATED_VERSION = "2026-11-13.9";
export const STANDARDS = ["webhook", "delete_copy", "no_email_copy", "snapshot_reconcile"];
export const SIGNATURE_TOLERANCE_SECONDS = 300;

const te = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** 驗證中央 webhook：X-HG-Signature = v1=HMAC-SHA256(金鑰, `${時間戳}.${原始內容}`)，常數時間比對，時間窗 5 分鐘。 */
export async function verifyWebhook(secret: string, timestamp: string | null, signature: string | null, raw: string, nowMs = Date.now()): Promise<boolean> {
  if (!timestamp || !signature || !/^\d{9,13}$/.test(timestamp)) return false;
  const t = Number(timestamp);
  const seconds = t > 1e12 ? t / 1000 : t;
  if (Math.abs(nowMs / 1000 - seconds) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = `v1=${hex(await crypto.subtle.sign("HMAC", key, te.encode(`${timestamp}.${raw}`)))}`;
  if (want.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

let svcToken: { token: string; until: number } | null = null;
async function serviceToken(secret: string): Promise<string | null> {
  if (svcToken && svcToken.until > Date.now() + 30_000) return svcToken.token;
  try {
    const res = await centralFetch(`${CENTRAL}/v1/service/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, client_secret: secret }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const b = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof b.access_token !== "string") return null;
    svcToken = { token: b.access_token, until: Date.now() + (typeof b.expires_in === "number" ? b.expires_in : 300) * 1000 };
    return svcToken.token;
  } catch {
    return null;
  }
}

export type ContactPurpose = "payment_notice" | "course_notice";

/**
 * 寄信時才向中央查聯絡信箱（用完即丟，不寫入資料庫或日誌）。查不到的會員不在結果裡；
 * 中央無法連線或金鑰無效時回傳空表（寧可不寄，也不用舊副本）。
 */
export async function lookupContactEmails(secret: string | undefined, subs: string[], purpose: ContactPurpose): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(subs)];
  if (!secret || !ids.length) return out;
  const token = await serviceToken(secret);
  if (!token) return out;
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const res = await centralFetch(`${CENTRAL}/v1/apps/${APP_ID}/contacts/lookup`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ member_ids: ids.slice(i, i + 50), purpose }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 401) svcToken = null;
      if (!res.ok) continue;
      const b = (await res.json()) as { contacts?: { member_id?: unknown; email?: unknown }[] };
      for (const c of b.contacts ?? []) if (typeof c.member_id === "string" && typeof c.email === "string" && validEmail(c.email)) out.set(c.member_id, c.email);
    } catch {
      /* 查不到就不寄 */
    }
  }
  return out;
}

let lastReport = 0;
/** 向中央回報採用的串接指令版本與已符合的標準（只有超級管理員的 token 會被接受；每小時最多一次，失敗不影響任何功能）。 */
export async function reportIntegration(token: string): Promise<void> {
  if (Date.now() - lastReport < 3_600_000) return;
  lastReport = Date.now();
  await callCentral(token, `/v1/apps/${APP_ID}/handoff?integrated=${INTEGRATED_VERSION}&standards=${STANDARDS.join(",")}`);
}
