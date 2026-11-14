/**
 * 逐字稿（試做）：把章節的 R2 音檔用 Workers AI 的 Whisper 轉成文字。
 *
 * 設計重點
 * - 一次只轉「一段」（每次呼叫處理第 N 段），由前端依序呼叫；中途額度用完就停，隔天（台灣 08:00 後）可從斷掉的那段接著做。
 * - 每一段送出前都先經過 reserveAi（每日免費額度閘門）；失敗會把預扣還回去，Cloudflare 回報額度用完時當天直接停。
 * - Worker 無法解碼影音，所以只能「依檔案位元組」切段：單段 ≤ 4MB 的整個檔案直接送；較大的檔案只支援 MP3（依 MP3 影格邊界切），
 *   其他格式（M4A 等）過大時請業主改傳 MP3。Mux／YouTube 的章節目前不支援（Worker 取不到純音訊）。
 */
import { AiStopped, loadSelection, markExhausted, refundAi, reserveAi } from "./ai-models.ts";
import type { D1Database, Env, R2Bucket } from "./d1.ts";

export const SINGLE_MAX = 4 * 1024 * 1024; // 整檔直送的上限
export const PART_BYTES = 3 * 1024 * 1024; // MP3 每段約 3MB（128kbps 約 3 分鐘）
const DEFAULT_BYTES_PER_MIN = 16000 * 60; // 沒有長度資料時，假設 128kbps

export type PartPlan = { total: number; bytesPerMinute: number; isMp3: boolean };

export function isMp3(key: string, contentType: string): boolean {
  return /mpeg|mp3/i.test(contentType) || /\.mp3$/i.test(key);
}

/** 依檔案大小決定要切幾段（不需讀檔案內容，隨時可重算）。 */
export function planParts(size: number, key: string, contentType: string, durationMinutes: number): PartPlan {
  const mp3 = isMp3(key, contentType);
  const bytesPerMinute = durationMinutes > 0 ? size / durationMinutes : DEFAULT_BYTES_PER_MIN;
  if (size <= SINGLE_MAX) return { total: 1, bytesPerMinute, isMp3: mp3 };
  if (!mp3) throw new TranscribeError("format_too_big", "這個音檔格式太大，無法自動分段；請改上傳 MP3（或把音檔切短）後再轉逐字稿");
  return { total: Math.ceil(size / PART_BYTES), bytesPerMinute, isMp3: true };
}

export class TranscribeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** 找出從 offset 起第一個 MP3 影格同步字（0xFFEx）。 */
export function findMp3Sync(buf: Uint8Array, from = 0): number {
  for (let i = from; i + 1 < buf.length; i++) if (buf[i] === 0xff && (buf[i + 1]! & 0xe0) === 0xe0) return i;
  return -1;
}

async function alignedStart(bucket: R2Bucket, key: string, size: number, nominal: number): Promise<number> {
  if (nominal <= 0) return 0;
  if (nominal >= size) return size;
  const win = await bucket.get(key, { range: { offset: nominal, length: Math.min(16384, size - nominal) } });
  if (!win) throw new TranscribeError("audio_missing", "找不到音檔");
  const buf = new Uint8Array(await new Response(win.body).arrayBuffer());
  const at = findMp3Sync(buf);
  return at < 0 ? nominal : nominal + at;
}

/** 第 part 段（從 0 起算）的位元組範圍。 */
export async function partRange(bucket: R2Bucket, key: string, size: number, plan: PartPlan, part: number): Promise<{ offset: number; length: number }> {
  if (plan.total === 1) return { offset: 0, length: size };
  const start = await alignedStart(bucket, key, size, part * PART_BYTES);
  const end = part + 1 >= plan.total ? size : await alignedStart(bucket, key, size, (part + 1) * PART_BYTES);
  return { offset: start, length: Math.max(1, end - start) };
}

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export type TranscriptView = { lessonId: string; status: "none" | "partial" | "done"; partsDone: number; partsTotal: number; model: string; text: string; minutes: number; updatedAt: string | null };

export async function transcriptView(db: D1Database, lessonId: string): Promise<TranscriptView> {
  const head = await db.prepare("SELECT parts_total, model, updated_at FROM lesson_transcripts WHERE lesson_id = ?").bind(lessonId).first<{ parts_total: number; model: string; updated_at: string }>();
  const parts = await db.prepare("SELECT text, minutes FROM lesson_transcript_parts WHERE lesson_id = ? ORDER BY part").bind(lessonId).all<{ text: string; minutes: number }>();
  const rows = parts.results ?? [];
  const total = head?.parts_total ?? 0;
  return {
    lessonId,
    status: !head ? "none" : rows.length >= total && total > 0 ? "done" : "partial",
    partsDone: rows.length,
    partsTotal: total,
    model: head?.model ?? "",
    text: rows.map((r) => r.text.trim()).filter(Boolean).join("\n"),
    minutes: Math.round(rows.reduce((a, r) => a + r.minutes, 0) * 10) / 10,
    updatedAt: head?.updated_at ?? null,
  };
}

/**
 * 轉下一段（已完成的段落會跳過）。回傳最新進度。
 * restart=true 會清掉舊的逐字稿重來。
 */
export async function transcribeNext(env: Env, db: D1Database, lessonId: string, opts: { restart?: boolean; now?: Date } = {}): Promise<TranscriptView> {
  const lesson = await db.prepare("SELECT media_type, media_ref, duration_minutes FROM lessons WHERE id = ?").bind(lessonId).first<{ media_type: string; media_ref: string | null; duration_minutes: number }>();
  if (!lesson) throw new TranscribeError("not_found", "找不到這個章節");
  if (lesson.media_type !== "audio" || !lesson.media_ref) throw new TranscribeError("unsupported_media", "目前只支援「上傳音檔」的章節（Mux／YouTube 影片尚未支援）");
  if (!env.AI) throw new TranscribeError("ai_not_ready", "尚未綁定 Workers AI");
  const bucket = env.MEDIA ?? (() => { throw new TranscribeError("storage_not_ready", "音檔儲存空間尚未啟用"); })();
  const head = await bucket.head(lesson.media_ref);
  if (!head) throw new TranscribeError("audio_missing", "找不到音檔");
  const plan = planParts(head.size, lesson.media_ref, head.httpMetadata?.contentType ?? "", lesson.duration_minutes);
  const sel = await loadSelection(db);
  const model = sel.transcribe ?? "@cf/openai/whisper-large-v3-turbo";

  if (opts.restart) await db.batch([db.prepare("DELETE FROM lesson_transcript_parts WHERE lesson_id = ?").bind(lessonId), db.prepare("DELETE FROM lesson_transcripts WHERE lesson_id = ?").bind(lessonId)]);
  await db.prepare("INSERT INTO lesson_transcripts (lesson_id, parts_total, model) VALUES (?, ?, ?) ON CONFLICT(lesson_id) DO UPDATE SET parts_total = excluded.parts_total").bind(lessonId, plan.total, model).run();
  const done = await db.prepare("SELECT part FROM lesson_transcript_parts WHERE lesson_id = ?").bind(lessonId).all<{ part: number }>();
  const have = new Set((done.results ?? []).map((r) => r.part));
  let next = 0;
  while (have.has(next)) next++;
  if (next >= plan.total) return transcriptView(db, lessonId);

  const range = await partRange(bucket, lesson.media_ref, head.size, plan, next);
  const minutes = Math.max(0.1, range.length / plan.bytesPerMinute);
  const est = await reserveAi(db, model, { minutes }, opts.now); // 超過今日額度會丟 AiStopped（隔天自動恢復，接著做）
  let text = "";
  try {
    const obj = await bucket.get(lesson.media_ref, plan.total === 1 ? undefined : { range });
    if (!obj) throw new TranscribeError("audio_missing", "找不到音檔");
    const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
    const out = (await env.AI.run(model, { audio: toBase64(bytes), language: "zh" })) as { text?: string };
    text = (out?.text ?? "").trim();
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/3036|daily free allocation/i.test(msg)) await markExhausted(db, opts.now);
    else await refundAi(db, est, opts.now);
    if (e instanceof TranscribeError) throw e;
    throw new TranscribeError("ai_failed", /3036|daily free allocation/i.test(msg) ? "今天的 AI 免費額度已用完，明天早上 8:00（台灣時間）後可接著繼續" : `逐字稿失敗：${msg.slice(0, 200)}`);
  }
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO lesson_transcript_parts (lesson_id, part, text, minutes) VALUES (?, ?, ?, ?)").bind(lessonId, next, text, minutes),
    db.prepare("UPDATE lesson_transcripts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE lesson_id = ?").bind(lessonId),
  ]);
  return transcriptView(db, lessonId);
}

export { AiStopped };
