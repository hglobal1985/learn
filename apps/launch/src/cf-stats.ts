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
const NO_PERMISSION = "這組 Cloudflare 權杖權限不足：請確認含「帳戶 → Account Analytics → 讀取」與「區域 → Analytics → 讀取」兩項";

async function gql(env: Env, query: string, variables: Obj, kind: "accounts" | "zones" = "accounts"): Promise<Obj> {
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
  if (res.status === 401 || res.status === 403) throw new CfError(NO_PERMISSION);
  const body = (await res.json().catch(() => ({}))) as { data?: Obj; errors?: { message?: string }[] };
  if (body.errors?.length) {
    const m = String(body.errors[0]?.message ?? "");
    if (/authz|not authorized|permission|does not have access/i.test(m)) throw new CfError(NO_PERMISSION);
    throw new CfError(`Cloudflare 回報錯誤：${m.slice(0, 100)}`);
  }
  if (!res.ok) throw new CfError(`Cloudflare 暫時無法連線（HTTP ${res.status}）`);
  const acc = arr(((body.data?.viewer ?? {}) as Obj)[kind])[0];
  if (!acc) throw new CfError(kind === "zones" ? "找不到這個網域的資料（請確認 CF_ZONE_ID 與權杖的區域權限）" : "找不到這個 Cloudflare 帳號的資料（請確認 CF_ACCOUNT_ID）");
  return acc;
}

async function block(id: string, title: string, level: StatBlock["level"], run: () => Promise<Partial<StatBlock>>): Promise<StatBlock> {
  try {
    return { id, title, level, ...(await run()) };
  } catch (e) {
    return { id, title, level, error: e instanceof CfError ? e.message : "讀取失敗" };
  }
}

const HOST = "learn.hglobal1985.com";
const DEVICE: Record<string, string> = { mobile: "手機", desktop: "電腦", tablet: "平板" };

export async function collectCfStats(env: Env): Promise<MuxStats> {
  const now = new Date();
  const out = (blocks: StatBlock[]): MuxStats => ({ generatedAt: now.toISOString(), freeMinutes: 0, blocks });
  if (!env.CF_API_TOKEN?.trim() || !env.CF_ACCOUNT_ID?.trim()) {
    return out([{ id: "cf_setup", title: "還沒有連上 Cloudflare", level: "core", error: "尚未設定 Cloudflare 讀取權杖（CF_API_TOKEN）" }]);
  }
  const acct = env.CF_ACCOUNT_ID.trim();
  const zone = env.CF_ZONE_ID?.trim();
  const iso = (d: Date) => d.toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400_000);
  const since14 = new Date(now.getTime() - 14 * 86400_000);
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Cloudflare 對查詢頻率有限制：把所有查詢合併成兩次請求（帳戶層級一次、網域層級一次），各區塊再從結果挑自己要的。
  const T = (d: Date) => `"${iso(d)}"`;
  const zf = `datetime_geq:${T(since30)},datetime_leq:${T(now)},clientRequestHTTPHost:"${HOST}"`;
  const rf = `datetime_geq:${T(since30)},datetime_leq:${T(now)},requestHost:"${HOST}"`;
  const wf = `scriptName:"${SCRIPT}",datetime_geq:${T(since30)},datetime_leq:${T(now)}`;
  const zoneDims: [string, string, number][] = [
    ["country", "clientCountryName", 10],
    ["device", "clientDeviceType", 10],
    ["paths", "clientRequestPath", 12],
    ["browser", "userAgentBrowser", 10],
    ["os", "userAgentOS", 10],
    ["status", "edgeResponseStatus", 12],
    ["method", "clientRequestHTTPMethodName", 10],
    ["ctype", "edgeResponseContentTypeName", 10],
    ["cache", "cacheStatus", 10],
    ["protocol", "clientRequestHTTPProtocol", 10],
    ["tls", "clientSSLProtocol", 10],
    ["colo", "coloCode", 10],
  ];
  const zoneQuery = `query{viewer{zones(filter:{zoneTag:"${zone ?? ""}"}){total:httpRequestsAdaptiveGroups(limit:1,filter:{${zf}}){count sum{edgeResponseBytes visits}} ${zoneDims.map(([k, d, n]) => `${k}:httpRequestsAdaptiveGroups(limit:${n},orderBy:[count_DESC],filter:{${zf}}){count dimensions{${d}}}`).join(" ")}}}}`;
  const rumDims: [string, string][] = [["pages", "requestPath"], ["ref", "refererHost"], ["rcountry", "countryName"], ["rdevice", "deviceType"]];
  const acctQuery = `query{viewer{accounts(filter:{accountTag:"${acct}"}){
    m:workersInvocationsAdaptive(limit:100,filter:{${wf}}){sum{requests errors} quantiles{cpuTimeP50 cpuTimeP99} dimensions{status}}
    t:workersInvocationsAdaptive(limit:100,filter:{scriptName:"${SCRIPT}",datetime_geq:${T(startToday)},datetime_leq:${T(now)}}){sum{requests}}
    d:workersInvocationsAdaptive(limit:100,orderBy:[date_ASC],filter:{scriptName:"${SCRIPT}",datetime_geq:${T(since14)},datetime_leq:${T(now)}}){sum{requests errors} dimensions{date}}
    pv:rumPageloadEventsAdaptiveGroups(limit:1,filter:{${rf}}){count sum{visits}}
    ${rumDims.map(([k, d]) => `${k}:rumPageloadEventsAdaptiveGroups(limit:10,orderBy:[count_DESC],filter:{${rf}}){count dimensions{${d}}}`).join(" ")}
    vitals:rumWebVitalsEventsAdaptiveGroups(limit:1,filter:{${rf}}){count quantiles{largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 firstContentfulPaintP75}}
    r2s:r2StorageAdaptiveGroups(limit:1000,filter:{bucketName:"${BUCKET}",datetime_geq:${T(since30)},datetime_leq:${T(now)}}){max{payloadSize objectCount}}
    r2o:r2OperationsAdaptiveGroups(limit:20,filter:{bucketName:"${BUCKET}",datetime_geq:${T(since30)},datetime_leq:${T(now)}}){sum{requests} dimensions{actionType}}
  }}}`;
  const acctP = gql(env, acctQuery, {}, "accounts");
  const zoneP = zone ? gql(env, zoneQuery, {}, "zones") : Promise.reject(new CfError("尚未設定網域代碼（CF_ZONE_ID）"));
  acctP.catch(() => undefined);
  zoneP.catch(() => undefined);

  const ranked = (rows: Obj[], dim: string, label: (v: string) => string) => {
    const total = rows.reduce((s, r) => s + num(r.count), 0) || 1;
    const max = Math.max(1, ...rows.map((r) => num(r.count)));
    return rows.map((r) => ({ label: label(String((r.dimensions as Obj)?.[dim] ?? "")), value: num(r.count), max, text: `${fmt(num(r.count))}（${fmt((num(r.count) / total) * 100, 1)}%）` }));
  };
  const zoneTop = (id: string, title: string, level: StatBlock["level"], label: (v: string) => string = (v) => v || "（未知）", note?: string) =>
    block(id, title, level, async () => {
      const key = id.replace(/^cf_/, "");
      const dim = zoneDims.find(([k]) => k === key)![1];
      const a = await zoneP;
      return { note: note ?? "近 30 天，依請求次數排序。", bars: ranked(arr(a[key]), dim, label) };
    });
  const rumTop = (id: string, title: string, level: StatBlock["level"], key: string, label: (v: string) => string = (v) => v || "（無）") =>
    block(id, title, level, async () => {
      const a = await acctP;
      const dim = rumDims.find(([k]) => k === key)![1];
      return { note: "近 30 天網頁瀏覽次數（只含用瀏覽器開網站的人，不含 App 內的畫面）。", bars: ranked(arr(a[key]), dim, label) };
    });

  const blocks = await Promise.all([
    // ================= 最常用 =================
    block("cf_requests", "網站請求數", "core", async () => {
      const a = await acctP;
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
      const a = await acctP;
      const rows = arr(a.d).map((r) => [String((r.dimensions as Obj)?.date ?? ""), fmt(num((r.sum as Obj)?.requests)), fmt(num((r.sum as Obj)?.errors))]);
      return { head: ["日期（UTC）", "請求數", "錯誤"], rows };
    }),
    block("cf_visits", "訪客與流量（含 App）", "core", async () => {
      const a = await zoneP;
      const g = arr(a.total)[0] ?? {};
      const sum = (g.sum ?? {}) as Obj;
      return {
        note: "訪客數＝一段時間內從外部來到網站的次數（Cloudflare 的「visits」定義，連續操作算一次）。",
        stats: [
          { label: "近 30 天訪客數", value: fmt(num(sum.visits)) },
          { label: "近 30 天請求數（含圖片、檔案）", value: fmt(num(g.count)) },
          { label: "近 30 天傳出資料量", value: `${fmt(num(sum.edgeResponseBytes) / 1024 / 1024, 1)} MB` },
        ],
      };
    }),
    block("cf_pageviews", "網頁瀏覽次數（瀏覽器版）", "core", async () => {
      const a = await acctP;
      const g = arr(a.pv)[0] ?? {};
      return {
        note: "Web Analytics 統計，只含用瀏覽器開網站的人，不含 App。",
        stats: [
          { label: "近 30 天瀏覽次數", value: fmt(num(g.count)) },
          { label: "近 30 天瀏覽訪客", value: fmt(num((g.sum as Obj)?.visits)) },
        ],
      };
    }),
    // ================= 常看 =================
    zoneTop("cf_country", "國家／地區（近 30 天）", "more"),
    zoneTop("cf_device", "手機或電腦（近 30 天）", "more", (v) => DEVICE[v] ?? (v || "（未知）")),
    rumTop("cf_pages", "最常被打開的網頁（瀏覽器版）", "more", "pages"),
    zoneTop("cf_paths", "最常被呼叫的功能（含 App）", "more", (v) => v || "/", "近 30 天請求次數；/api/v2/… 是 App 與網頁讀寫資料的功能，/cdn-cgi/rum 是流量統計本身。"),
    zoneTop("cf_browser", "瀏覽器（近 30 天）", "more"),
    zoneTop("cf_os", "作業系統（近 30 天）", "more"),
    block("cf_vitals", "網頁載入體驗（瀏覽器版）", "more", async () => {
      const a = await acctP;
      const qn = ((arr(a.vitals)[0]?.quantiles ?? {}) as Obj);
      return {
        note: "多數（前 75%）使用者實際感受到的速度。越小越好；Google 建議：最大內容載入 2.5 秒內、互動延遲 200 毫秒內、版面位移 0.1 以下。",
        stats: [
          { label: "最大內容載入時間（LCP）", value: `${fmt(num(qn.largestContentfulPaintP75) / 1_000_000, 2)} 秒` },
          { label: "首次內容出現（FCP）", value: `${fmt(num(qn.firstContentfulPaintP75) / 1_000_000, 2)} 秒` },
          { label: "互動延遲（INP）", value: `${fmt(num(qn.interactionToNextPaintP75) / 1000, 0)} 毫秒` },
          { label: "版面位移（CLS）", value: fmt(num(qn.cumulativeLayoutShiftP75), 3) },
        ],
      };
    }),
    block("cf_speed", "後端處理速度（近 30 天）", "more", async () => {
      const a = await acctP;
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
      const a = await acctP;
      const st = arr(a.r2s);
      const size = st.reduce((m, r) => Math.max(m, num((r.max as Obj)?.payloadSize)), 0);
      const count = st.reduce((m, r) => Math.max(m, num((r.max as Obj)?.objectCount)), 0);
      const ops = arr(a.r2o);
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
    // ================= 進階（少用）=================
    rumTop("cf_ref", "來源網站（瀏覽器版）", "advanced", "ref", (v) => v || "（直接輸入網址或從 App 開啟）"),
    rumTop("cf_rcountry", "網頁瀏覽：國家／地區", "advanced", "rcountry"),
    rumTop("cf_rdevice", "網頁瀏覽：手機或電腦", "advanced", "rdevice", (v) => DEVICE[v] ?? (v || "（未知）")),
    zoneTop("cf_status", "回應結果（狀態碼）", "advanced", (v) => ({ "200": "200 成功", "204": "204 成功（無內容）", "206": "206 部分內容（影音）", "301": "301 轉址", "302": "302 轉址", "304": "304 未變更", "400": "400 請求有誤", "401": "401 未登入", "403": "403 沒有權限", "404": "404 找不到", "409": "409 衝突", "429": "429 太頻繁", "500": "500 伺服器錯誤" })[v] ?? v),
    zoneTop("cf_method", "請求方式", "advanced", (v) => ({ GET: "GET 讀取", POST: "POST 新增", PUT: "PUT 取代", PATCH: "PATCH 修改", DELETE: "DELETE 刪除", HEAD: "HEAD 檢查" })[v] ?? v),
    zoneTop("cf_ctype", "內容類型", "advanced", (v) => ({ json: "資料（JSON）", html: "網頁", js: "程式（JS）", css: "樣式（CSS）", txt: "文字", png: "圖片（PNG）", jpg: "圖片（JPG）", mp3: "音檔", mp4: "影片" })[v] ?? (v || "（未知）")),
    zoneTop("cf_cache", "快取狀況", "advanced", (v) => ({ none: "未使用快取", hit: "命中快取", miss: "未命中", dynamic: "動態內容", bypass: "略過快取" })[v] ?? v),
    zoneTop("cf_protocol", "連線協定版本", "advanced"),
    zoneTop("cf_tls", "加密版本", "advanced"),
    zoneTop("cf_colo", "服務你的 Cloudflare 機房", "advanced", (v) => v || "（未知）", "近 30 天，依請求次數排序（機房代碼：TPE 台北、SIN 新加坡、SJC 聖荷西…）。"),
  ]);
  return out(blocks);
}
