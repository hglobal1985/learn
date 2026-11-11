/**
 * 中央會員串接（https://id.hglobal1985.com）：
 * - 驗證 Access Token（RS256、typ=at+jwt、iss/aud、app_id=learn、exp），會員主鍵只用 sub。
 * - 獎銜資格一律即時向中央查詢（fail closed），結果只放記憶體快取，不寫入資料庫或日誌。
 * - 管理員 = 中央職務 super_admin / secretary / course（課務）。
 * 日誌不得出現 Token、信箱、姓名。
 */
export const CENTRAL = "https://id.hglobal1985.com";
export const APP_ID = "learn";
const ADMIN_ROLES = new Set(["super_admin", "secretary", "course"]);

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
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.value as T;
  const value = await load();
  memo.set(key, { value, until: Date.now() + ttlMs });
  if (memo.size > 2000) memo.delete(memo.keys().next().value!);
  return value;
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

/** 顯示名稱（供訂單審核辨識；不是 Amway 資料）。 */
export async function displayName(sub: string, token: string): Promise<string> {
  return cached(`name:${sub}`, 300_000, async () => {
    const res = await callCentral(token, "/v1/me/profile");
    if (!res?.ok) return "會員";
    const body = (await res.json().catch(() => null)) as { fields?: Record<string, { value?: unknown }> } | null;
    const v = body?.fields?.display_name?.value;
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 50) : "會員";
  });
}

/** 是否為本 App 管理員：中央職務 super_admin / secretary / course。查不到一律否。 */
export async function isAdmin(sub: string, token: string): Promise<boolean> {
  return cached(`admin:${sub}`, 60_000, async () => {
    const res = await callCentral(token, "/v1/admin/me");
    if (!res?.ok) return false;
    const body = (await res.json().catch(() => null)) as { member_id?: string; roles?: { role?: string }[] } | null;
    return body?.member_id === sub && !!body.roles?.some((r) => ADMIN_ROLES.has(r.role ?? ""));
  });
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
