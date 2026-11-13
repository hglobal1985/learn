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

/** 附件教材：同樣的短效簽名網址（1 小時），鍵前綴 files/。檔名由資料表取得，不放在網址裡。 */
export async function fileUrl(env: Env, key: string, seconds = 3600): Promise<string | null> {
  if (!env.MEDIA || !env.MEDIA_URL_SECRET) return null;
  const exp = Math.floor(Date.now() / 1000) + seconds;
  return `/api/v2/media/file?k=${encodeURIComponent(key)}&e=${exp}&s=${await hmac(env.MEDIA_URL_SECRET, `${key}|${exp}`)}`;
}

export async function verifyFileUrl(env: Env, url: URL): Promise<string | null> {
  const key = url.searchParams.get("k") ?? "";
  const exp = Number(url.searchParams.get("e"));
  const sig = url.searchParams.get("s") ?? "";
  if (!env.MEDIA_URL_SECRET || !key.startsWith("files/") || !Number.isInteger(exp) || exp < Date.now() / 1000) return null;
  const expected = await hmac(env.MEDIA_URL_SECRET, `${key}|${exp}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? key : null;
}

export function sniffImage(b: Uint8Array): { ext: "jpg" | "png" | "webp"; type: string } | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: "webp", type: "image/webp" };
  return null;
}
