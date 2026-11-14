/** AI 模型清單與各項工作選用的模型（超級管理員在「設定 → AI 模型」切換；選擇存在 ui_settings 的 ai_models 一筆 JSON）。 */
import type { D1Database } from "./d1.ts";

export type AiKind = "speech" | "text" | "embedding";
export type AiModel = {
  id: string;
  name: string;
  vendor: string;
  kind: AiKind;
  /** 估計花費（約略值，實際以官方牌價為準） */
  cost: string;
  /** 花費等級，方便一眼比較 */
  costLevel: "低" | "中" | "高";
  strengths: string;
  bestFor: string;
  /** 用量換算成 Workers AI 的「點數」（neuron）；外部模型（Claude）沒有免費額度，所以沒有 */
  neurons?: { perMinute?: number; perMInput?: number; perMOutput?: number };
  /** 需要另外申請金鑰（由業主在 Cloudflare 後台設定，不放程式裡） */
  needsKey: boolean;
};
export type AiJob = { key: string; label: string; desc: string; kind: AiKind; default: string };

export const AI_JOBS: AiJob[] = [
  { key: "transcribe", label: "逐字稿（語音轉文字）", desc: "把課程影片／音檔的聲音轉成逐字稿", kind: "speech", default: "@cf/openai/whisper-large-v3-turbo" },
  { key: "keywords", label: "關鍵字與 hashtag", desc: "從逐字稿整理重點關鍵字、hashtag、摘要", kind: "text", default: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { key: "embedding", label: "語意搜尋", desc: "把文字轉成向量，讓搜尋「疼痛」也找得到「不舒服」", kind: "embedding", default: "@cf/baai/bge-m3" },
];

export const AI_MODELS: AiModel[] = [
  { id: "@cf/openai/whisper-large-v3-turbo", name: "Whisper Large v3 Turbo", vendor: "Cloudflare（OpenAI 模型）", kind: "speech", cost: "約 US$0.0005／音訊分鐘（1 小時約 US$0.03）；每天免費額度約可轉 200 分鐘", costLevel: "低", strengths: "速度快、支援中文等 90 多種語言，準確度高", bestFor: "課程逐字稿的首選", neurons: { perMinute: 46.63 }, needsKey: false },
  { id: "@cf/openai/whisper", name: "Whisper（標準版）", vendor: "Cloudflare（OpenAI 模型）", kind: "speech", cost: "約 US$0.0005／音訊分鐘；每天免費額度約可轉 240 分鐘", costLevel: "低", strengths: "較舊的版本，點數略省，中文準確度略低", bestFor: "免費額度快不夠、對準確度要求不高時", neurons: { perMinute: 41.14 }, needsKey: false },
  { id: "@cf/meta/llama-3.1-8b-instruct-fp8-fast", name: "Llama 3.1 8B（快速版）", vendor: "Cloudflare（Meta 模型）", kind: "text", cost: "約 US$0.045／百萬字進、US$0.384／百萬字出", costLevel: "低", strengths: "速度快、最省額度；中文理解普通，偶爾抓錯重點", bestFor: "大量、簡單的整理（短關鍵字）", neurons: { perMInput: 4119, perMOutput: 34868 }, needsKey: false },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B", vendor: "Cloudflare（Meta 模型）", kind: "text", cost: "約 US$0.293／百萬字進、US$2.253／百萬字出", costLevel: "中", strengths: "理解力與中文表現比 8B 好很多，仍在 Cloudflare 內不需金鑰", bestFor: "關鍵字、hashtag、摘要（預設）", neurons: { perMInput: 26668, perMOutput: 204805 }, needsKey: false },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", vendor: "Anthropic", kind: "text", cost: "依 Anthropic 官方牌價計費（需另外申請金鑰，沒有每日免費額度）", costLevel: "中", strengths: "中文整理與歸納品質高、速度快", bestFor: "品質要求較高的摘要與關鍵字", needsKey: true },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", vendor: "Anthropic", kind: "text", cost: "依 Anthropic 官方牌價計費（需另外申請金鑰，沒有每日免費額度），比 Haiku 貴", costLevel: "高", strengths: "理解與寫作最細緻，能處理很長的逐字稿", bestFor: "重要課程的精修摘要；日常不建議（較貴）", needsKey: true },
  { id: "@cf/baai/bge-m3", name: "BGE-M3", vendor: "Cloudflare（BAAI 模型）", kind: "embedding", cost: "約 US$0.0118／百萬字", costLevel: "低", strengths: "多語言（100 多種），中文與中英混用表現好", bestFor: "語意搜尋的首選（預設）", neurons: { perMInput: 1073 }, needsKey: false },
];

const KEY = "ai_models";
const USAGE_KEY = "ai_settings";
export type AiSelection = Record<string, string>;

/** Cloudflare Workers AI 每天免費 10,000 點，UTC 00:00（台灣時間 08:00）重新計算。 */
export const FREE_DAILY_NEURONS = 10000;
export const CAP_CHOICES = [5000, 7000, 9000] as const;
export type AiSettings = { freeOnly: boolean; dailyCap: number; capEnabled: boolean };
export const DEFAULT_AI_SETTINGS: AiSettings = { freeOnly: true, dailyCap: 9000, capEnabled: true };

export function defaultSelection(): AiSelection {
  return Object.fromEntries(AI_JOBS.map((j) => [j.key, j.default]));
}

/** 只接受「該工作種類」的已知模型，其他退回預設。 */
export function normalizeSelection(raw: unknown): AiSelection {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = defaultSelection();
  for (const j of AI_JOBS) {
    const m = AI_MODELS.find((x) => x.id === r[j.key]);
    if (m && m.kind === j.kind) out[j.key] = m.id;
  }
  return out;
}

export async function loadSelection(db: D1Database): Promise<AiSelection> {
  const row = await db.prepare("SELECT value FROM ui_settings WHERE key = ?").bind(KEY).first<{ value: string }>();
  try {
    return normalizeSelection(row ? JSON.parse(row.value) : {});
  } catch {
    return defaultSelection();
  }
}

export async function saveSelection(db: D1Database, sel: AiSelection): Promise<void> {
  await db
    .prepare("INSERT INTO ui_settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(KEY, JSON.stringify(sel))
    .run();
}

// ───────────── 每日免費額度控管 ─────────────

export function normalizeSettings(raw: unknown, base: AiSettings = DEFAULT_AI_SETTINGS): AiSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    capEnabled: r.capEnabled === undefined ? base.capEnabled : r.capEnabled === true,
    freeOnly: r.freeOnly === undefined ? base.freeOnly : r.freeOnly === true,
    dailyCap: (CAP_CHOICES as readonly number[]).includes(r.dailyCap as number) ? (r.dailyCap as number) : base.dailyCap,
  };
}

export async function loadSettings(db: D1Database): Promise<AiSettings> {
  const row = await db.prepare("SELECT value FROM ui_settings WHERE key = ?").bind(USAGE_KEY).first<{ value: string }>();
  try {
    return normalizeSettings(row ? JSON.parse(row.value) : {});
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export async function saveSettings(db: D1Database, st: AiSettings): Promise<void> {
  await db
    .prepare("INSERT INTO ui_settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(USAGE_KEY, JSON.stringify(st))
    .run();
}

/** 用日期（UTC）當帳；跟 Cloudflare 的每日重置同一時刻，所以隔天自然歸零、自動恢復。 */
export const usageDay = (now = new Date()): string => now.toISOString().slice(0, 10);

export type AiWork = { minutes?: number; inputTokens?: number; outputTokens?: number };

/** 估算這次工作會用掉幾點；外部模型（沒有點數）回傳 null。 */
export function estimateNeurons(modelId: string, w: AiWork): number | null {
  const n = AI_MODELS.find((m) => m.id === modelId)?.neurons;
  if (!n) return null;
  return Math.ceil((w.minutes ?? 0) * (n.perMinute ?? 0) + ((w.inputTokens ?? 0) / 1e6) * (n.perMInput ?? 0) + ((w.outputTokens ?? 0) / 1e6) * (n.perMOutput ?? 0));
}

export async function todayUsed(db: D1Database, day = usageDay()): Promise<number> {
  const row = await db.prepare("SELECT neurons FROM ai_usage WHERE day = ?").bind(day).first<{ neurons: number }>();
  return row?.neurons ?? 0;
}

export class AiStopped extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * 呼叫 AI 之前先「預扣」額度：今天已用＋這次估算超過上限就拒絕（等隔天 UTC 00:00＝台灣 08:00 自動恢復）。
 * 開啟「只用免費額度」時，沒有免費額度的外部模型一律拒絕。
 * 預扣是一個原子操作，同時多個工作也不會一起衝過上限。
 */
export async function reserveAi(db: D1Database, modelId: string, w: AiWork, now = new Date()): Promise<number> {
  const st = await loadSettings(db);
  const est = estimateNeurons(modelId, w);
  if (est === null) {
    if (st.freeOnly) throw new AiStopped("目前設定為「只用免費額度」，這個模型沒有免費額度，已停止");
    return 0;
  }
  const day = usageDay(now);
  await db.prepare("INSERT OR IGNORE INTO ai_usage (day, neurons) VALUES (?, 0)").bind(day).run();
  if (!st.capEnabled) {
    // 額度限制已關閉：照常記錄用量，但不擋（超過免費額度時由 Cloudflare 依方案處理，付費方案會計費）
    await db.prepare("UPDATE ai_usage SET neurons = neurons + ? WHERE day = ?").bind(est, day).run();
    return est;
  }
  const r = await db.prepare("UPDATE ai_usage SET neurons = neurons + ? WHERE day = ? AND neurons + ? <= ?").bind(est, day, est, st.dailyCap).run();
  if (r.meta?.changes === 0) throw new AiStopped("今天的 AI 免費額度已用完（自動停止），明天早上 8:00（台灣時間）自動恢復");
  return est;
}

/** 工作失敗時把預扣的點數還回去（Cloudflare 沒扣的話）。 */
export async function refundAi(db: D1Database, est: number, now = new Date()): Promise<void> {
  if (est > 0) await db.prepare("UPDATE ai_usage SET neurons = MAX(0, neurons - ?) WHERE day = ?").bind(est, usageDay(now)).run();
}

/** Cloudflare 回報「今天免費額度已用完」（錯誤 3036）時，把今天直接記成用完，之後的工作在隔天前都不會再送出。 */
export async function markExhausted(db: D1Database, now = new Date()): Promise<void> {
  const day = usageDay(now);
  await db.prepare("INSERT OR IGNORE INTO ai_usage (day, neurons) VALUES (?, 0)").bind(day).run();
  await db.prepare("UPDATE ai_usage SET neurons = MAX(neurons, ?) WHERE day = ?").bind(FREE_DAILY_NEURONS, day).run();
}

export async function usageSummary(db: D1Database, now = new Date()) {
  const st = await loadSettings(db);
  const used = await todayUsed(db, usageDay(now));
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { ...st, day: usageDay(now), used: Math.round(used), freeDaily: FREE_DAILY_NEURONS, stopped: st.capEnabled && used >= st.dailyCap, resumesAt: next.toISOString(), capChoices: CAP_CHOICES };
}

// ───────────── 金鑰／連線狀態與測試 ─────────────
import type { Env } from "./d1.ts";

export type AiKeyStatus = { key: "workers_ai" | "anthropic"; label: string; ready: boolean; need: string; steps: string };

/** 只回報「有沒有設定」，絕不回傳金鑰內容。 */
export function keyStatuses(env: Env): AiKeyStatus[] {
  return [
    { key: "workers_ai", label: "Cloudflare Workers AI", ready: !!env.AI, need: "不需要金鑰，只需綁定", steps: "已在程式設定檔綁定（名稱 AI），部署後即可使用；用量計入 Cloudflare 帳號的每日免費額度。" },
    {
      key: "anthropic",
      label: "Anthropic（Claude）",
      ready: !!env.ANTHROPIC_API_KEY,
      need: "需要 API 金鑰（Secret，名稱 ANTHROPIC_API_KEY）",
      steps: "1. 到 Anthropic 後台建立 API 金鑰　2. 到 Cloudflare 後台 → Workers 和 Pages → learn → 設定 → 變數和密碼 → 新增，類型選「密碼（Secret）」，名稱 ANTHROPIC_API_KEY，貼上金鑰後儲存　3. 回到這裡按「測試連線」。金鑰請直接貼在 Cloudflare 後台，不要貼在對話或程式裡。",
    },
  ];
}

/** 測試連線：送一個極小的請求（照樣經過額度閘門，用量計入今日）。成功回傳說明文字，失敗丟出 Error。 */
export async function testConnection(env: Env, db: D1Database, target: string): Promise<string> {
  if (target === "workers_ai") {
    if (!env.AI) throw new Error("尚未綁定 Workers AI（需重新部署）");
    const est = await reserveAi(db, "@cf/baai/bge-m3", { inputTokens: 5 });
    try {
      await env.AI.run("@cf/baai/bge-m3", { text: ["hi"] });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/3036|daily free allocation/i.test(msg)) await markExhausted(db);
      else await refundAi(db, est);
      throw new Error(`Workers AI 連線失敗：${msg.slice(0, 200)}`);
    }
    return "Workers AI 連線成功";
  }
  if (target === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("尚未設定 ANTHROPIC_API_KEY");
    await reserveAi(db, "claude-haiku-5-5", { inputTokens: 5 }); // 開啟「只用免費模型」時會被擋
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    });
    if (!res.ok) throw new Error(`Claude 連線失敗（${res.status}）${res.status === 401 ? "：金鑰不正確" : ""}`);
    return "Claude 連線成功";
  }
  throw new Error("不明的測試目標");
}
