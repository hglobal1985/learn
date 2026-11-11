import type { Env } from "./d1.ts";

/**
 * Mux Signed Playback：只在後端確認學員已開通後，簽出短效播放 JWT。
 * 需要 Worker Secrets：MUX_SIGNING_KEY_ID、MUX_SIGNING_PRIVATE_KEY（PEM，或整段 PEM 再 Base64）。
 * 未設定時回傳 null（API 回 503），不洩漏 Playback ID。
 */
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

function pkcs8(secret: string): Uint8Array<ArrayBuffer> {
  let pem = secret.trim();
  if (!pem.includes("-----BEGIN")) pem = atob(pem.replace(/\s/g, ""));
  if (pem.includes("BEGIN RSA PRIVATE KEY")) throw Error("pkcs1_not_supported");
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

let cachedKey: { id: string; key: CryptoKey } | null = null;

export async function muxPlaybackUrl(env: Env, playbackId: string, seconds = 6 * 3600): Promise<string | null> {
  if (!env.MUX_SIGNING_KEY_ID || !env.MUX_SIGNING_PRIVATE_KEY) return null;
  try {
    if (!cachedKey || cachedKey.id !== env.MUX_SIGNING_KEY_ID) {
      const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.MUX_SIGNING_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
      cachedKey = { id: env.MUX_SIGNING_KEY_ID, key };
    }
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT", kid: env.MUX_SIGNING_KEY_ID })}.${b64urlJson({ sub: playbackId, aud: "v", exp: now + seconds })}`;
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cachedKey.key, new TextEncoder().encode(unsigned)));
    return `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8?token=${unsigned}.${b64url(sig)}`;
  } catch {
    console.error("mux signing failed");
    return null;
  }
}
