import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

/**
 * 中央會員登入（登入中繼，Google）。App 不持有密碼或 client secret。
 * Access Token：記憶體（App 另存安全儲存以便重開）；Refresh Token：App 用 SecureStore、Web 用 sessionStorage。
 * 換發加鎖，新的 refresh token 立刻覆蓋舊的。
 */
export const CENTRAL_URL = "https://id.hglobal1985.com";
export const APP_ID = "learn";
export const ACCOUNT_URL = `${CENTRAL_URL}/my/edit`;
const WEB_RETURN = "https://learn.hglobal1985.com/auth/done";
const NATIVE_RETURN = "learn://auth/google";
const REFRESH_KEY = "hglobal.learn.refresh";
const ACCESS_KEY = "hglobal.learn.access";
const ACCESS_EXP_KEY = "hglobal.learn.access-expiry";
const PENDING_KEY = "hglobal.learn.pending";

type TokenPair = { access_token: string; refresh_token: string; expires_in: number };
type SignIn = TokenPair & { user: { member_id: string; status: string } };
export type AppStatus = { status: "active" | "paused" | "killed"; min_version: string };
type Pending = { nonce: string; state: string; created: number; returnTo: string };

let access: string | null = null;
let expiry = 0;
let inflight: Promise<boolean> | null = null;

export class CentralError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function central<T>(path: string, method = "GET", body?: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(CENTRAL_URL + path, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new CentralError(0, "network", "登入服務暫時連不上，請稍後再試");
  }
  if (!res.ok) {
    const e = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error;
    const code = e?.code ?? "central_error";
    const message =
      code === "app_unavailable" ? "目前正在維護中，請稍後再試" : code === "account_disabled" ? "此帳號已停用，請聯絡客服" : "登入失敗，請再試一次";
    throw new CentralError(res.status, code, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const web = Platform.OS === "web";
const storage = {
  async get(key: string) {
    return web ? globalThis.sessionStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string | null) {
    if (web) {
      if (value) globalThis.sessionStorage?.setItem(key, value);
      else globalThis.sessionStorage?.removeItem(key);
    } else if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  },
};

export async function appStatus(): Promise<AppStatus> {
  return central<AppStatus>(`/v1/apps/${APP_ID}/config`);
}

export function isOutdated(version: string, min: string): boolean {
  const parse = (x: string) => x.split(".").slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parse(version), parse(min)];
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

async function remember(pair: TokenPair) {
  // 先保存新的 refresh token，再允許後續請求。
  await storage.set(REFRESH_KEY, pair.refresh_token);
  access = pair.access_token;
  expiry = Date.now() + Math.max(0, pair.expires_in - 30) * 1000;
  if (!web) {
    await storage.set(ACCESS_KEY, access);
    await storage.set(ACCESS_EXP_KEY, String(expiry));
  }
}

export async function clearCentral(): Promise<void> {
  access = null;
  expiry = 0;
  await Promise.all([storage.set(REFRESH_KEY, null), storage.set(ACCESS_KEY, null), storage.set(ACCESS_EXP_KEY, null)]);
}

export async function hasCentralSession(): Promise<boolean> {
  return !!(access || (await storage.get(REFRESH_KEY)));
}

export async function refresh(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = (async () => {
    const rt = await storage.get(REFRESH_KEY);
    if (!rt) return false;
    try {
      await remember(await central<TokenPair>("/v1/auth/refresh", "POST", { refresh_token: rt }));
      return true;
    } catch (e) {
      // 網路問題時保留登入，其他錯誤（含 refresh_reused）清除。
      if (!(e instanceof CentralError && e.status === 0)) await clearCentral();
      return false;
    }
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** 取得有效的 Access Token（必要時換發）；沒有中央登入時回傳 null。 */
export async function centralToken(): Promise<string | null> {
  if (access && Date.now() < expiry) return access;
  if (!web) {
    const [saved, exp] = await Promise.all([storage.get(ACCESS_KEY), storage.get(ACCESS_EXP_KEY)]);
    if (saved && Number(exp) > Date.now()) {
      access = saved;
      expiry = Number(exp);
      return access;
    }
  }
  return (await refresh()) ? access : null;
}

const randomHex = () => Array.from(Crypto.getRandomBytes(24), (b) => b.toString(16).padStart(2, "0")).join("");
const safePath = (p: string) => (p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") ? p : "/");

/** 開始 Google 登入。Web 會整頁導向（回傳 "redirecting"）；App 開系統登入視窗。 */
export async function signInWithGoogle(returnTo = "/me"): Promise<"ok" | "cancelled" | "redirecting"> {
  const status = await appStatus();
  if (status.status !== "active") throw new CentralError(503, "app_unavailable", "目前正在維護中，請稍後再試");
  const { nonce } = await central<{ nonce: string }>("/v1/auth/nonce", "POST", { app_id: APP_ID });
  const pending: Pending = { nonce, state: randomHex(), created: Date.now(), returnTo: safePath(returnTo) };
  const digest = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)).toLowerCase();
  const url = new URL(`${CENTRAL_URL}/auth/google/start`);
  url.searchParams.set("app_id", APP_ID);
  url.searchParams.set("nonce", digest);
  url.searchParams.set("return", web ? WEB_RETURN : NATIVE_RETURN);
  url.searchParams.set("state", pending.state);
  if (web) {
    globalThis.sessionStorage?.setItem(PENDING_KEY, JSON.stringify(pending));
    globalThis.location.assign(url.toString());
    return "redirecting";
  }
  const result = await WebBrowser.openAuthSessionAsync(url.toString(), NATIVE_RETURN);
  if (result.type !== "success") return "cancelled";
  const back = new URL(result.url);
  if (back.protocol !== "learn:" || back.hostname !== "auth" || back.pathname !== "/google") throw new CentralError(400, "bad_return", "登入回傳網址無效");
  await finish(back.searchParams, pending);
  return "ok";
}

async function finish(params: URLSearchParams, pending: Pending): Promise<void> {
  if (Date.now() - pending.created > 600_000 || params.get("state") !== pending.state) throw new CentralError(400, "state", "登入驗證已逾時，請重新登入");
  if (params.get("error")) throw new CentralError(400, "cancelled", "登入已取消");
  const idToken = params.get("id_token");
  if (!idToken) throw new CentralError(400, "no_token", "沒有取得登入資料，請重新登入");
  const data = await central<SignIn>("/v1/auth/google", "POST", { app_id: APP_ID, id_token: idToken, nonce: pending.nonce });
  if (data.user.status !== "active") {
    await clearCentral();
    throw new CentralError(403, "inactive", "此帳號尚未啟用");
  }
  await remember(data);
}

/** Web：在 /auth/done 讀取 fragment 完成登入，回傳登入前的頁面。 */
export async function finishWebReturn(): Promise<string> {
  const fragment = globalThis.location.hash.slice(1);
  globalThis.history.replaceState(null, "", globalThis.location.pathname);
  const raw = globalThis.sessionStorage?.getItem(PENDING_KEY);
  globalThis.sessionStorage?.removeItem(PENDING_KEY);
  if (!raw) throw new CentralError(400, "no_pending", "登入狀態已失效，請重新登入");
  const pending = JSON.parse(raw) as Pending;
  await finish(new URLSearchParams(fragment), pending);
  return safePath(pending.returnTo);
}

/** 登出。all＝true：登出所有 App、所有裝置與會員中心網站（POST /v1/auth/logout-all）；否則只登出這個 App 的這次登入。 */
export async function signOutCentral(all = false): Promise<void> {
  const token = access ?? (await storage.get(ACCESS_KEY));
  if (token && all) {
    try {
      await central("/v1/auth/logout-all", "POST", undefined, token);
    } catch {
      // 存取權杖（15 分鐘）過期時先換發一次，再登出所有 App。
      if (await refresh().catch(() => false)) {
        const fresh = access;
        if (fresh) await central("/v1/auth/logout-all", "POST", undefined, fresh).catch(() => undefined);
      }
    }
  } else if (token) await central("/v1/auth/logout", "POST", undefined, token).catch(() => undefined);
  await clearCentral();
}

// ---------- 共用登入（網頁版，同一個瀏覽器內連動）----------
// 會員中心記住這個瀏覽器；本站以整頁導向詢問（/auth/sso/check），回到 /auth/sso 處理結果。

const SSO_RETURN = "https://learn.hglobal1985.com/auth/sso";
const SSO_CHECKED = "hglobal.learn.sso-checked";
const SSO_PENDING = "hglobal.learn.sso-pending";
const SSO_NEXT = "hglobal.learn.sso-next";
const SSO_INTERVAL = 5 * 60_000;
type SsoPending = { nonce: string; state: string; created: number };

const ss = () => globalThis.sessionStorage;
const here = () => safePath(globalThis.location.pathname + globalThis.location.search);

/** 載入頁面時（5 分鐘節流）向會員中心詢問這個瀏覽器目前登入的會員。會整頁導向時回傳 true。 */
export async function webSsoCheck(): Promise<boolean> {
  if (!web || !globalThis.location || globalThis.location.hostname !== "learn.hglobal1985.com") return false;
  if (globalThis.location.pathname.startsWith("/auth/")) return false;
  const last = Number(ss()?.getItem(SSO_CHECKED) ?? 0);
  if (Date.now() - last < SSO_INTERVAL) return false;
  ss()?.setItem(SSO_CHECKED, String(Date.now()));
  try {
    const { nonce } = await central<{ nonce: string }>("/v1/auth/nonce", "POST", { app_id: APP_ID });
    const pending: SsoPending = { nonce, state: randomHex(), created: Date.now() };
    ss()?.setItem(SSO_PENDING, JSON.stringify(pending));
    ss()?.setItem(SSO_NEXT, here());
    const digest = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)).toLowerCase();
    const url = new URL(`${CENTRAL_URL}/auth/sso/check`);
    url.searchParams.set("app_id", APP_ID);
    url.searchParams.set("nonce", digest);
    url.searchParams.set("return", SSO_RETURN);
    url.searchParams.set("state", pending.state);
    globalThis.location.replace(url.toString());
    return true;
  } catch {
    return false; // 會員中心連不上：照常使用，需要登入的功能由伺服器拒絕。
  }
}

/**
 * 處理 /auth/sso 的回傳（#sso_code／#sso_none／#sso_adopted），回傳之後要前往的頁面。
 * currentMember：本機目前登入的會員 ID（沒有則 null）。
 */
export async function handleWebSsoReturn(currentMember: string | null): Promise<{ next: string; changed: boolean }> {
  const params = new URLSearchParams(globalThis.location.hash.slice(1));
  globalThis.history.replaceState(null, "", globalThis.location.pathname);
  const next = safePath(ss()?.getItem(SSO_NEXT) ?? "/");
  ss()?.removeItem(SSO_NEXT);
  const raw = ss()?.getItem(SSO_PENDING);
  ss()?.removeItem(SSO_PENDING);
  const pending = raw ? (JSON.parse(raw) as SsoPending) : null;
  if (params.get("sso_adopted")) return { next, changed: false };
  if (!pending || params.get("state") !== pending.state || Date.now() - pending.created > 600_000) return { next, changed: false };
  if (params.get("sso_none")) {
    if (currentMember) {
      await clearCentral();
      return { next, changed: true };
    }
    return { next, changed: false };
  }
  const code = params.get("sso_code");
  const member = params.get("sso_member");
  if (!code || (member && member === currentMember)) return { next, changed: false };
  try {
    await remember(await central<TokenPair>("/v1/auth/sso/web-exchange", "POST", { app_id: APP_ID, code, nonce: pending.nonce }));
    return { next, changed: true };
  } catch {
    return { next, changed: false };
  }
}

/** 網頁版登入成功後：讓會員中心記住這個瀏覽器（之後其他 App 自動登入）。會整頁導向。 */
export async function webSsoAdopt(next: string): Promise<boolean> {
  if (!web) return false;
  try {
    const token = await centralToken();
    if (!token) return false;
    const { sso_token } = await central<{ sso_token: string }>("/v1/auth/sso/start", "POST", {}, token);
    const { code } = await central<{ code: string }>("/v1/auth/sso/web-code", "POST", { sso_token }, token);
    ss()?.setItem(SSO_NEXT, safePath(next));
    ss()?.setItem(SSO_CHECKED, String(Date.now()));
    const url = new URL(`${CENTRAL_URL}/auth/sso/adopt`);
    url.searchParams.set("c", code);
    url.searchParams.set("app_id", APP_ID);
    url.searchParams.set("return", SSO_RETURN);
    globalThis.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

/** 網頁版登出：清除本機後導向會員中心登出這個瀏覽器的所有 App。 */
export function webSsoLogout(next = "/me"): void {
  if (!web) return;
  ss()?.setItem(SSO_NEXT, safePath(next));
  ss()?.setItem(SSO_CHECKED, String(Date.now()));
  const url = new URL(`${CENTRAL_URL}/auth/sso/logout`);
  url.searchParams.set("app_id", APP_ID);
  url.searchParams.set("return", SSO_RETURN);
  globalThis.location.replace(url.toString());
}
