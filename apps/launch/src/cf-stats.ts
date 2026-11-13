/**
 * 統計分析（Cloudflare 網站流量）：用 Cloudflare 的分析 API（GraphQL）讀取本網站（Worker「learn」）的請求數與
 * 檔案儲存（R2）用量。需要 Secret「CF_API_TOKEN」（權限：Account Analytics 讀取）；帳號代碼 CF_ACCOUNT_ID 為一般變數。
 * 每一區塊獨立讀取，讀不到只顯示該區原因。
 */
import type { MuxStats, StatBlock } from "./contract.ts";
import type { Env } from "./d1.ts";

type Obj = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });

/** Workers 免費方案每天的請求額度（付費方案不受此限，僅供參考）。 */
const FREE_DAILY_REQUESTS = 100_000;
const SCRIPT = "learn";
const BUCKET = "learn";

class CfError extends Error {}

async function gql(env: Env, query: string, variables: Obj): Promise<Obj> {
  let res: Response;
  try {
    res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new CfError("Cloudflare 暫時無法連線，請稍後再試");
  }
  if (res.status === 401 || res.status === 403) throw new CfError("這組 Cloudflare 權杖沒有讀取分析資料的權限（請確認權限含 Account Analytics：Read）");
  const body = (await res.json().catch(() => ({}))) as { data?: Obj; errors?: { message?: string }[] };
  if (body.errors?.length) {
    const m = String(body.errors[0]?.message ?? "");
    if (/authz|not authorized|permission/i.test(m)) throw new CfError("這組 Cloudflare 權杖沒有讀取分析資料的權限（請確認權限含 Account Analytics：Read）");
    throw new CfError(`Cloudflare 回報錯誤：${m.slice(0, 100)}`);
  }
  if (!res.ok) throw new CfError(`Cloudflare 暫時無法連線（HTTP ${res.status}）`);
  const acc = arr(((body.data?.viewer ?? {}) as Obj).accounts)[0];
  if (!acc) throw new CfError("找不到這個 Cloudflare 帳號的資料（請確認 CF_ACCOUNT_ID）");
  return acc;
}

async function block(id: string, title: string, level: StatBlock["level"], run: () => Promise<Partial<StatBlock>>): Promise<StatBlock> {
  try {
    return { id, title, level, ...(await run()) };
  } catch (e) {
    return { id, title, level, error: e instanceof CfError ? e.message : "讀取失敗" };
  }
}

export async function collectCfStats(env: Env): Promise<MuxStats> {
  const now = new Date();
  const out = (blocks: StatBlock[]): MuxStats => ({ generatedAt: now.toISOString(), freeMinutes: 0, blocks });
  if (!env.CF_API_TOKEN?.trim() || !env.CF_ACCOUNT_ID?.trim()) {
    return out([{ id: "cf_setup", title: "還沒有連上 Cloudflare", level: "core", error: "尚未設定 Cloudflare 讀取權杖（CF_API_TOKEN）" }]);
  }
  const acct = env.CF_ACCOUNT_ID.trim();
  const iso = (d: Date) => d.toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400_000);
  const since14 = new Date(now.getTime() - 14 * 86400_000);
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const q = (inner: string) => `query($acc:String!,$since:Time!,$until:Time!){viewer{accounts(filter:{accountTag:$acc}){${inner}}}}`;
  const wf = `scriptName:"${SCRIPT}",datetime_geq:$since,datetime_leq:$until`;
  const vars = (since: Date) => ({ acc: acct, since: iso(since), until: iso(now) });

  const blocks = await Promise.all([
    block("cf_requests", "網站請求數", "core", async () => {
      const a = await gql(env, q(`m:workersInvocationsAdaptive(limit:100,filter:{${wf}}){sum{requests errors} dimensions{status}} t:workersInvocationsAdaptive(limit:100,filter:{scriptName:"${SCRIPT}",datetime_geq:"${iso(startToday)}",datetime_leq:$until}){sum{requests}}`), vars(since30));
      const total = arr(a.m).reduce((s, r) => s + num((r.sum as Obj)?.requests), 0);
      const errors = arr(a.m).reduce((s, r) => s + num((r.sum as Obj)?.errors), 0);
      const today = arr(a.t).reduce((s, r) => s + num((r.sum as Obj)?.requests), 0);
      return {
        note: "每次打開 App 或網頁、載入畫面與資料，都算一次請求（統計的是 Worker「learn」）。",
        stats: [
          { label: "近 30 天請求數", value: fmt(total) },
          { label: "近 30 天發生錯誤", value: fmt(errors), sub: total ? `${fmt((errors / total) * 100, 2)}%` : undefined },
          { label: "今天（UTC）請求數", value: fmt(today) },
        ],
        bars: [{ label: "今天請求數 / 免費方案每日額度（付費方案可忽略）", value: today, max: FREE_DAILY_REQUESTS, text: `${fmt(today)} / ${fmt(FREE_DAILY_REQUESTS)}` }],
      };
    }),
    block("cf_daily", "每日請求數（近 14 天）", "core", async () => {
      const a = await gql(env, q(`d:workersInvocationsAdaptive(limit:100,orderBy:[date_ASC],filter:{${wf}}){sum{requests errors} dimensions{date}}`), vars(since14));
      const rows = arr(a.d).map((r) => [String((r.dimensions as Obj)?.date ?? ""), fmt(num((r.sum as Obj)?.requests)), fmt(num((r.sum as Obj)?.errors))]);
      return { head: ["日期（UTC）", "請求數", "錯誤"], rows };
    }),
    block("cf_speed", "後端處理速度（近 30 天）", "more", async () => {
      const a = await gql(env, q(`m:workersInvocationsAdaptive(limit:100,filter:{${wf}}){quantiles{cpuTimeP50 cpuTimeP99} sum{requests}}`), vars(since30));
      const rows = arr(a.m);
      const w = rows.reduce((s, r) => s + num((r.sum as Obj)?.requests), 0) || 1;
      const avg = (k: string) => rows.reduce((s, r) => s + num((r.quantiles as Obj)?.[k]) * num((r.sum as Obj)?.requests), 0) / w;
      return {
        note: "CPU 時間＝伺服器真正在運算的時間（不含等待網路或資料庫）。",
        stats: [
          { label: "一般請求（中位數）", value: `${fmt(avg("cpuTimeP50") / 1000, 2)} 毫秒` },
          { label: "較慢的請求（前 1%）", value: `${fmt(avg("cpuTimeP99") / 1000, 1)} 毫秒` },
        ],
      };
    }),
    block("cf_r2", "檔案儲存（R2：音檔、EDM、封面）", "more", async () => {
      const a = await gql(env, q(`s:r2StorageAdaptiveGroups(limit:1000,filter:{bucketName:"${BUCKET}",datetime_geq:$since,datetime_leq:$until}){max{payloadSize objectCount}} o:r2OperationsAdaptiveGroups(limit:20,filter:{bucketName:"${BUCKET}",datetime_geq:$since,datetime_leq:$until}){sum{requests} dimensions{actionType}}`), vars(since30));
      const st = arr(a.s);
      const size = st.reduce((m, r) => Math.max(m, num((r.max as Obj)?.payloadSize)), 0);
      const count = st.reduce((m, r) => Math.max(m, num((r.max as Obj)?.objectCount)), 0);
      const ops = arr(a.o);
      const read = ops.filter((r) => /^(Get|Head)Object$/.test(String((r.dimensions as Obj)?.actionType))).reduce((s, r) => s + num((r.sum as Obj)?.requests), 0);
      const write = ops.filter((r) => /^(Put|Delete|UploadPart|CompleteMultipart|CreateMultipart)/.test(String((r.dimensions as Obj)?.actionType))).reduce((s, r) => s + num((r.sum as Obj)?.requests), 0);
      return {
        stats: [
          { label: "已用空間", value: `${fmt(size / 1024 / 1024, 1)} MB` },
          { label: "檔案數量", value: fmt(count) },
          { label: "近 30 天讀取次數", value: fmt(read) },
          { label: "近 30 天寫入／刪除次數", value: fmt(write) },
        ],
      };
    }),
  ]);
  return out(blocks);
}
