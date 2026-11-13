/**
 * 統計分析：把 Mux API 能提供的數據整理成一頁報表。最常用的排前面（免費額度、近 30 天觀看、熱門影片），
 * 次要的（影片庫存、各影片傳輸量、播放品質）其次，進階的（裝置與瀏覽器、國家、錯誤、直播）放最後。
 * 每一區塊獨立讀取，某一區讀不到（例如金鑰沒有 Mux Data 權限）只會在該區顯示原因，不影響其他區。
 * Mux 回傳格式以官方文件為準，這裡一律用保守寫法（欄位不存在就略過）。
 */
import type { StatBlock, MuxStats } from "./contract.ts";
import type { Env } from "./d1.ts";
import { MuxApiError, muxGetJson } from "./mux.ts";

/** Mux 免費方案每月的影片傳輸額度（分鐘）；實際額度以你的 Mux 方案為準。 */
export const FREE_DELIVERY_MINUTES = 100_000;

type Obj = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

function whyFailed(e: unknown, data = false): string {
  if (e instanceof MuxApiError) {
    if (e.code === "mux_api_not_configured") return "尚未設定 Mux API 存取權杖（MUX_TOKEN_ID／MUX_TOKEN_SECRET）";
    if (e.code === "mux_api_unauthorized") return data ? "這組 Mux 存取權杖沒有「Mux Data」讀取權限；請到 Mux 後台 Settings → API Access Tokens 建立含 Mux Data「Read」的權杖" : "這組 Mux 存取權杖沒有讀取權限";
    return `Mux 暫時無法連線，請稍後再試${e.detail ? `（${e.detail}）` : ""}`;
  }
  return "讀取失敗";
}

async function block(id: string, title: string, level: StatBlock["level"], data: boolean, run: () => Promise<Partial<StatBlock>>): Promise<StatBlock> {
  try {
    return { id, title, level, ...(await run()) };
  } catch (e) {
    return { id, title, level, error: whyFailed(e, data) };
  }
}

/** 影片傳輸量（Video API delivery-usage）：近 N 天，依影片加總的秒數。 */
async function deliveryUsage(env: Env, from0: Date, to0: Date): Promise<Obj[]> {
  // Mux 規定結束時間至少要在 12 小時前（最新半天的資料尚未結算）；月初資料未結算時回傳空。
  const to = new Date(to0.getTime() - 13 * 3600_000);
  const from = from0;
  if (from.getTime() >= to.getTime() - 3600_000) return []; // 月初資料還沒結算：視為 0，不往上個月借
  const out: Obj[] = [];
  for (let page = 1; page <= 10; page++) {
    const q = `/video/v1/delivery-usage?limit=100&page=${page}&timeframe[]=${Math.floor(from.getTime() / 1000)}&timeframe[]=${Math.floor(to.getTime() / 1000)}`;
    const body = (await muxGetJson(env, q)) as Obj;
    const rows = arr(body.data);
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

const overall = async (env: Env, metric: string, days = 30): Promise<Obj> => (((await muxGetJson(env, `/data/v1/metrics/${metric}/overall?timeframe[]=${days}:days`)) as Obj).data as Obj) ?? {};
const breakdown = async (env: Env, metric: string, groupBy: string, days = 30, limit = 8): Promise<Obj[]> =>
  arr(((await muxGetJson(env, `/data/v1/metrics/${metric}/breakdown?group_by=${groupBy}&order_by=views&order_direction=desc&limit=${limit}&timeframe[]=${days}:days`)) as Obj).data);

export async function collectMuxStats(env: Env): Promise<MuxStats> {
  const now = new Date();
  if (!env.MUX_TOKEN_ID?.trim() || !env.MUX_TOKEN_SECRET?.trim()) {
    return { generatedAt: now.toISOString(), freeMinutes: FREE_DELIVERY_MINUTES, blocks: [{ id: "setup", title: "還沒有連上 Mux", level: "core", error: whyFailed(new MuxApiError("mux_api_not_configured")) }] };
  }
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const blocks = await Promise.all([
    // ---- 最常用 ----
    block("free_quota", "本月免費額度使用量", "core", false, async () => {
      const rows = await deliveryUsage(env, monthStart, now);
      const minutes = rows.reduce((a, r) => a + num(r.delivered_seconds), 0) / 60;
      const daysLeft = Math.max(1, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate() - now.getUTCDate() + 1);
      const passed = Math.max(1, now.getUTCDate());
      const projected = (minutes / passed) * (passed + daysLeft - 1);
      return {
        note: `Mux 免費方案每月約 ${fmt(FREE_DELIVERY_MINUTES)} 分鐘傳輸量（實際額度以你的 Mux 方案為準）。統計區間：${dayStr(monthStart)} 起。`,
        stats: [
          { label: "本月已使用", value: `${fmt(minutes)} 分鐘`, sub: `約 ${fmt(minutes / 60, 1)} 小時` },
          { label: "剩餘額度", value: `${fmt(Math.max(0, FREE_DELIVERY_MINUTES - minutes))} 分鐘` },
          { label: "依目前速度，本月預估", value: `${fmt(projected)} 分鐘`, sub: projected > FREE_DELIVERY_MINUTES ? "可能超出免費額度" : "在額度內" },
        ],
        bars: [{ label: "免費額度", value: minutes, max: FREE_DELIVERY_MINUTES, text: `${fmt((minutes / FREE_DELIVERY_MINUTES) * 100, 1)}%` }],
      };
    }),
    block("views_30d", "近 30 天觀看概況", "core", true, async () => {
      const [v, u, t] = await Promise.all([overall(env, "views"), overall(env, "unique_viewers"), overall(env, "playing_time")]);
      const watchMs = num(v.total_watch_time) || num(t.value);
      return {
        stats: [
          { label: "觀看次數", value: fmt(num(v.total_views) || num(v.value)) },
          { label: "不重複觀眾", value: fmt(num(u.value) || num(u.total_views)) },
          { label: "總觀看時間", value: `${fmt(watchMs / 60000)} 分鐘`, sub: `約 ${fmt(watchMs / 3600000, 1)} 小時` },
        ],
      };
    }),
    block("top_videos", "熱門影片（近 30 天）", "core", true, async () => {
      const rows = await breakdown(env, "views", "video_title", 30, 10);
      return { head: ["影片", "觀看次數", "觀看分鐘"], rows: rows.map((r) => [String(r.field ?? "（未命名）").slice(0, 40), fmt(num(r.views) || num(r.value)), fmt(num(r.total_watch_time) / 60000)]) };
    }),
    // ---- 次要 ----
    block("assets", "影片庫存", "more", false, async () => {
      let total = 0,
        seconds = 0,
        ready = 0,
        errored = 0;
      for (let page = 1; page <= 10; page++) {
        const rows = arr(((await muxGetJson(env, `/video/v1/assets?limit=100&page=${page}`)) as Obj).data);
        for (const a of rows) {
          total++;
          seconds += num(a.duration);
          if (a.status === "ready") ready++;
          else if (a.status === "errored") errored++;
        }
        if (rows.length < 100) break;
      }
      return { stats: [{ label: "影片數量", value: fmt(total) }, { label: "可播放", value: fmt(ready) }, { label: "處理失敗", value: fmt(errored) }, { label: "總長度", value: `${fmt(seconds / 60)} 分鐘`, sub: `約 ${fmt(seconds / 3600, 1)} 小時（儲存量）` }] };
    }),
    block("usage_by_asset", "各影片本月傳輸量", "more", false, async () => {
      const rows = (await deliveryUsage(env, monthStart, now)).sort((a, b) => num(b.delivered_seconds) - num(a.delivered_seconds)).slice(0, 10);
      const max = Math.max(1, ...rows.map((r) => num(r.delivered_seconds)));
      return { bars: rows.map((r) => ({ label: String(r.asset_id ?? "").slice(0, 14), value: num(r.delivered_seconds), max, text: `${fmt(num(r.delivered_seconds) / 60)} 分鐘` })) };
    }),
    block("quality", "播放品質（近 30 天）", "more", true, async () => {
      const [rebuf, startup, fail, exits, score] = await Promise.all(["rebuffer_percentage", "video_startup_time", "playback_failure_percentage", "exits_before_video_start", "viewer_experience_score"].map((m) => overall(env, m)));
      return {
        stats: [
          { label: "觀看體驗分數", value: fmt(num(score.value) * 100, 0), sub: "滿分 100" },
          { label: "卡頓比例", value: `${fmt(num(rebuf.value) * 100, 2)}%` },
          { label: "平均起播時間", value: `${fmt(num(startup.value) / 1000, 2)} 秒` },
          { label: "播放失敗比例", value: `${fmt(num(fail.value) * 100, 2)}%` },
          { label: "開播前離開比例", value: `${fmt(num(exits.value) * 100, 2)}%` },
        ],
      };
    }),
    // ---- 進階 ----
    ...(["operating_system", "browser", "country"] as const).map((dim) =>
      block(`dim_${dim}`, dim === "operating_system" ? "作業系統分布（近 30 天）" : dim === "browser" ? "瀏覽器分布（近 30 天）" : "國家／地區分布（近 30 天）", "advanced", true, async () => {
        const rows = await breakdown(env, "views", dim, 30, 8);
        const max = Math.max(1, ...rows.map((r) => num(r.views) || num(r.value)));
        return { bars: rows.map((r) => ({ label: String(r.field ?? "（未知）"), value: num(r.views) || num(r.value), max, text: `${fmt(num(r.views) || num(r.value))} 次` })) };
      }),
    ),
    block("errors", "播放錯誤（近 7 天）", "advanced", true, async () => {
      const rows = arr(((await muxGetJson(env, "/data/v1/errors?timeframe[]=7:days&limit=10")) as Obj).data);
      return { head: ["錯誤", "次數", "影響觀看"], rows: rows.map((r) => [`${r.code ?? ""} ${String(r.message ?? "").slice(0, 40)}`.trim(), fmt(num(r.count)), fmt(num(r.percentage), 2) + "%"]) };
    }),
    block("live", "直播串流", "advanced", false, async () => {
      const rows = arr(((await muxGetJson(env, "/video/v1/live-streams?limit=100")) as Obj).data);
      return { stats: [{ label: "直播串流數量", value: fmt(rows.length) }] };
    }),
  ]);
  const order = { core: 0, more: 1, advanced: 2 } as const;
  blocks.sort((a, b) => order[a.level] - order[b.level]);
  return { generatedAt: now.toISOString(), freeMinutes: FREE_DELIVERY_MINUTES, blocks };
}
