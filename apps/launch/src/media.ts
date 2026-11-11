import type { Env } from "./d1.ts";

/**
 * R2 音檔的短效簽名網址：/api/v2/media/audio?k=<物件鍵>&e=<到期秒>&s=<HMAC>。
 * 播放器（<audio>、原生播放器）無法帶 Authorization 標頭，所以由後端確認開通後簽發，6 小時內有效。
 * 簽章金鑰為 Worker Secret MEDIA_URL_SECRET。
 */
const enc = new TextEncoder();
const b64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function audioUrl(env: Env, key: string, seconds = 6 * 3600): Promise<string | null> {
  if (!env.MEDIA || !env.MEDIA_URL_SECRET) return null;
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const sig = await hmac(env.MEDIA_URL_SECRET, `${key}|${exp}`);
  return `/api/v2/media/audio?k=${encodeURIComponent(key)}&e=${exp}&s=${sig}`;
}

export async function verifyAudioUrl(env: Env, url: URL): Promise<string | null> {
  const key = url.searchParams.get("k") ?? "";
  const exp = Number(url.searchParams.get("e"));
  const sig = url.searchParams.get("s") ?? "";
  if (!env.MEDIA_URL_SECRET || !key.startsWith("audio/") || !Number.isInteger(exp) || exp < Date.now() / 1000) return null;
  const expected = await hmac(env.MEDIA_URL_SECRET, `${key}|${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? key : null;
}
