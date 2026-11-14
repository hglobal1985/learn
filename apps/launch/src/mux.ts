import type { Env } from "./d1.ts";

/**
 * Mux Signed Playback：只在後端確認學員已開通後，簽出短效播放 JWT。
 * 需要 MUX_SIGNING_KEY_ID（一般變數即可）與 Secret MUX_SIGNING_PRIVATE_KEY（格式見 parsePrivateKey）。
 * 未設定時回傳 null（API 回 503），不洩漏 Playback ID。
 */
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

/**
 * Mux 後台／API 給的私鑰通常是 Base64(PEM)，PEM 內常是 PKCS#1（BEGIN RSA PRIVATE KEY）。
 * 支援：Base64(PEM)、PEM PKCS#8、PEM PKCS#1、Base64 的 PKCS#8 DER；含字面上的 \n 也可。
 */
function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const clean = value.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw Error("invalid_key");
  return Uint8Array.from(atob(clean + "=".repeat((4 - (clean.length % 4)) % 4)), (c) => c.charCodeAt(0));
}
function derLength(n: number): number[] {
  if (n < 128) return [n];
  const bytes: number[] = [];
  for (let x = n; x; x = Math.floor(x / 256)) bytes.unshift(x & 255);
  return [0x80 | bytes.length, ...bytes];
}
function der(tag: number, body: Uint8Array): Uint8Array<ArrayBuffer> {
  const head = [tag, ...derLength(body.length)];
  const out = new Uint8Array(head.length + body.length);
  out.set(head);
  out.set(body, head.length);
  return out;
}
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array<ArrayBuffer> {
  const version = [0x02, 0x01, 0x00];
  const rsaAlgorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = der(0x04, pkcs1);
  const body = new Uint8Array(version.length + rsaAlgorithm.length + octet.length);
  body.set(version);
  body.set(rsaAlgorithm, version.length);
  body.set(octet, version.length + rsaAlgorithm.length);
  return der(0x30, body);
}
export function parsePrivateKey(secret: string): Uint8Array<ArrayBuffer> {
  let text = secret.trim().replace(/\\n/g, "\n");
  if (!text.includes("-----BEGIN ")) {
    const decoded = fromB64(text);
    const maybePem = new TextDecoder().decode(decoded);
    if (!maybePem.includes("-----BEGIN ")) return decoded;
    text = maybePem;
  }
  const m = /-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]*?)-----END (RSA )?PRIVATE KEY-----/.exec(text);
  if (!m || (m[1] ?? "") !== (m[3] ?? "")) throw Error("invalid_key");
  const bytes = fromB64(m[2]);
  return m[1] ? pkcs1ToPkcs8(bytes) : bytes;
}

let cachedKey: { id: string; key: CryptoKey } | null = null;

/** 簽出 Mux JWT：aud "v" 播放、"t" 縮圖。金鑰未設定或無效時回傳 null。 */
async function signToken(env: Env, playbackId: string, aud: "v" | "t", seconds: number): Promise<string | null> {
  const keyId = env.MUX_SIGNING_KEY_ID?.trim();
  if (!keyId || !env.MUX_SIGNING_PRIVATE_KEY) return null;
  try {
    if (!cachedKey || cachedKey.id !== keyId) {
      const key = await crypto.subtle.importKey("pkcs8", parsePrivateKey(env.MUX_SIGNING_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      cachedKey = { id: keyId, key };
    }
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT", kid: keyId })}.${b64urlJson({ sub: playbackId, aud, exp: now + seconds })}`;
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cachedKey.key, new TextEncoder().encode(unsigned)));
    return `${unsigned}.${b64url(sig)}`;
  } catch (e) {
    // 只記錄錯誤種類，不記錄金鑰內容。
    console.error("mux signing failed", e instanceof Error ? e.name : "unknown");
    return null;
  }
}

export async function muxPlaybackUrl(env: Env, playbackId: string, seconds = 6 * 3600): Promise<string | null> {
  const token = await signToken(env, playbackId, "v", seconds);
  return token ? `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8?token=${token}` : null;
}

/** 影片某一秒的截圖（Mux 縮圖 API，簽名 JWT aud "t"）：管理員挑章節封面時用。回傳圖片位元組；金鑰未設定或 Mux 拒絕時回 null。 */
export async function muxThumbnail(env: Env, playbackId: string, timeSeconds: number, width = 1280): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | null> {
  const token = await signToken(env, playbackId, "t", 300);
  if (!token) return null;
  const t = Math.max(0, Math.round(timeSeconds * 10) / 10);
  try {
    const res = await muxFetch(`https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg?time=${t}&width=${Math.min(1920, Math.max(160, Math.round(width)))}&token=${token}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "image/jpeg" };
  } catch {
    return null;
  }
}

/** 管理員「播放檢查」：從伺服器向 Mux 取得簽名播放清單，回報 Mux 是否接受。 */
export async function checkMuxPlayback(env: Env, playbackId: string): Promise<{ ok: boolean; message: string }> {
  const url = await muxPlaybackUrl(env, playbackId);
  if (!url) return { ok: false, message: "簽名金鑰未設定或格式不正確（MUX_SIGNING_KEY_ID／MUX_SIGNING_PRIVATE_KEY）" };
  try {
    const res = await muxFetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return { ok: true, message: "Mux 接受簽名，影片可以播放" };
    if (res.status === 403) return { ok: false, message: "Mux 拒絕簽名（403）：請確認簽名金鑰與這支影片屬於同一個 Mux 環境" };
    if (res.status === 404) return { ok: false, message: "Mux 找不到這支影片（404）：請重新從 Mux 選擇影片" };
    return { ok: false, message: `Mux 回應 ${res.status}` };
  } catch {
    return { ok: false, message: "連不到 Mux，請稍後再試" };
  }
}

// ---------- Mux 影片清單（管理員匯入用） ----------

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
let muxFetch: Fetch = (input, init) => fetch(input, init);
/** 測試用：替換對 Mux API 的請求。 */
export function setMuxFetch(f: Fetch): void {
  muxFetch = f;
}

export type MuxAsset = {
  assetId: string;
  title: string;
  durationSeconds: number | null;
  createdAt: string | null;
  status: string;
  /** 可以匯入的 Signed Playback ID；只有公開播放 ID 的影片為 null（不能用於需授權的課程）。 */
  signedPlaybackId: string | null;
  thumbnailUrl: string | null;
};

type RawAsset = {
  id: string;
  status?: string;
  duration?: number;
  created_at?: string;
  passthrough?: string;
  meta?: { title?: string };
  playback_ids?: { id: string; policy: string }[];
};

export class MuxApiError extends Error {
  code: "mux_api_not_configured" | "mux_api_unauthorized" | "mux_api_unavailable";
  /** Mux 回的 HTTP 狀態與簡短說明（除錯用，不含金鑰）。 */
  detail: string;
  constructor(code: MuxApiError["code"], detail = "") {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/** 讀取 Mux 帳號中的影片（需要 MUX_TOKEN_ID 與 MUX_TOKEN_SECRET，建議只給 Video 讀取權限）。 */
export async function listMuxAssets(env: Env, cursor?: string): Promise<{ assets: MuxAsset[]; nextCursor: string | null }> {
  const id = env.MUX_TOKEN_ID?.trim();
  const secret = env.MUX_TOKEN_SECRET?.trim();
  if (!id || !secret) throw new MuxApiError("mux_api_not_configured");
  const url = new URL("https://api.mux.com/video/v1/assets");
  url.searchParams.set("limit", "50");
  if (cursor) url.searchParams.set("cursor", cursor);
  let res: Response;
  try {
    res = await muxFetch(url.toString(), { headers: { authorization: `Basic ${btoa(`${id}:${secret}`)}` }, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new MuxApiError("mux_api_unavailable");
  }
  if (res.status === 401 || res.status === 403) throw new MuxApiError("mux_api_unauthorized");
  if (!res.ok) throw new MuxApiError("mux_api_unavailable");
  const body = (await res.json()) as { data?: RawAsset[]; next_cursor?: string | null };
  const assets = await Promise.all(
    (body.data ?? []).map(async (a): Promise<MuxAsset> => {
      const signed = a.playback_ids?.find((p) => p.policy === "signed")?.id ?? null;
      const thumb = signed ? await signToken(env, signed, "t", 3600) : null;
      return {
        assetId: a.id,
        title: (a.meta?.title || a.passthrough || "").trim().slice(0, 120),
        durationSeconds: typeof a.duration === "number" ? a.duration : null,
        createdAt: a.created_at ? new Date(Number(a.created_at) * 1000).toISOString() : null,
        status: a.status ?? "unknown",
        signedPlaybackId: signed,
        thumbnailUrl: signed && thumb ? `https://image.mux.com/${encodeURIComponent(signed)}/thumbnail.jpg?token=${thumb}` : null,
      };
    }),
  );
  return { assets, nextCursor: body.next_cursor ?? null };
}

/** 對 Mux API 發 GET（Basic 驗證，用 MUX_TOKEN_ID／MUX_TOKEN_SECRET）。失敗丟 MuxApiError；status 記錄 HTTP 狀態。 */
export async function muxGetJson(env: Env, path: string): Promise<unknown> {
  const id = env.MUX_TOKEN_ID?.trim();
  const secret = env.MUX_TOKEN_SECRET?.trim();
  if (!id || !secret) throw new MuxApiError("mux_api_not_configured");
  let res: Response;
  try {
    res = await muxFetch(`https://api.mux.com${path}`, { headers: { authorization: `Basic ${btoa(`${id}:${secret}`)}` }, signal: AbortSignal.timeout(12000) });
  } catch (e) {
    throw new MuxApiError("mux_api_unavailable", `連線失敗：${e instanceof Error ? e.name : "未知"}`);
  }
  if (res.status === 401 || res.status === 403) throw new MuxApiError("mux_api_unauthorized", `HTTP ${res.status}`);
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { error?: { messages?: string[]; type?: string } };
      msg = (j.error?.messages?.[0] ?? j.error?.type ?? "").slice(0, 120);
    } catch {
      /* 讀不到說明就算了 */
    }
    throw new MuxApiError("mux_api_unavailable", `HTTP ${res.status}${msg ? `：${msg}` : ""}`);
  }
  return res.json();
}
