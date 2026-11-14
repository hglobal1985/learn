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
  { id: "@cf/openai/whisper-large-v3-turbo", name: "Whisper Large v3 Turbo", vendor: "Cloudflare（OpenAI 模型）", kind: "speech", cost: "約 US$0.0005／音訊分鐘（1 小時約 US$0.03）", costLevel: "低", strengths: "速度快、支援中文等 90 多種語言，準確度高", bestFor: "課程逐字稿的首選", needsKey: false },
  { id: "@cf/openai/whisper", name: "Whisper（標準版）", vendor: "Cloudflare（OpenAI 模型）", kind: "speech", cost: "約 US$0.00045／音訊分鐘", costLevel: "低", strengths: "較舊的版本，便宜一點點，中文準確度略低", bestFor: "預算極度吃緊、對準確度要求不高時", needsKey: false },
  { id: "@cf/meta/llama-3.1-8b-instruct-fp8", name: "Llama 3.1 8B", vendor: "Cloudflare（Meta 模型）", kind: "text", cost: "約 US$0.28／百萬字進、US$0.83／百萬字出", costLevel: "低", strengths: "速度快、最便宜；中文理解普通，偶爾抓錯重點", bestFor: "大量、簡單的整理（短關鍵字）", needsKey: false },
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B", vendor: "Cloudflare（Meta 模型）", kind: "text", cost: "約 US$0.29／百萬字進、US$2.25／百萬字出", costLevel: "中", strengths: "理解力與中文表現比 8B 好很多，仍在 Cloudflare 內不需金鑰", bestFor: "關鍵字、hashtag、摘要（預設）", needsKey: false },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", vendor: "Anthropic", kind: "text", cost: "依 Anthropic 官方牌價計費（需另外申請金鑰）", costLevel: "中", strengths: "中文整理與歸納品質高、速度快", bestFor: "品質要求較高的摘要與關鍵字", needsKey: true },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", vendor: "Anthropic", kind: "text", cost: "依 Anthropic 官方牌價計費（需另外申請金鑰），比 Haiku 貴", costLevel: "高", strengths: "理解與寫作最細緻，能處理很長的逐字稿", bestFor: "重要課程的精修摘要；日常不建議（較貴）", needsKey: true },
  { id: "@cf/baai/bge-m3", name: "BGE-M3", vendor: "Cloudflare（BAAI 模型）", kind: "embedding", cost: "約 US$0.012／百萬字", costLevel: "低", strengths: "多語言，中文與中英混用表現好", bestFor: "語意搜尋的首選（預設）", needsKey: false },
  { id: "@cf/baai/bge-base-en-v1.5", name: "BGE Base（英文版）", vendor: "Cloudflare（BAAI 模型）", kind: "embedding", cost: "約 US$0.067／百萬字", costLevel: "低", strengths: "英文為主，中文效果差", bestFor: "純英文內容；本站不建議", needsKey: false },
];

const KEY = "ai_models";
export type AiSelection = Record<string, string>;

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
