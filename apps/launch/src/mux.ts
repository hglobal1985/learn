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

export async function muxPlaybackUrl(env: Env, playbackId: string, seconds = 6 * 3600): Promise<string | null> {
  const keyId = env.MUX_SIGNING_KEY_ID?.trim();
  if (!keyId || !env.MUX_SIGNING_PRIVATE_KEY) return null;
  try {
    if (!cachedKey || cachedKey.id !== keyId) {
      const key = await crypto.subtle.importKey("pkcs8", parsePrivateKey(env.MUX_SIGNING_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      cachedKey = { id: keyId, key };
    }
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT", kid: keyId })}.${b64urlJson({ sub: playbackId, aud: "v", exp: now + seconds })}`;
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cachedKey.key, new TextEncoder().encode(unsigned)));
    return `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8?token=${unsigned}.${b64url(sig)}`;
  } catch (e) {
    // 只記錄錯誤種類，不記錄金鑰內容。
    console.error("mux signing failed", e instanceof Error ? e.name : "unknown");
    return null;
  }
}
