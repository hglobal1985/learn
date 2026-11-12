# 寰宇行動大學：新對話交接包（2026-11-12）

給接手的 AI：先讀這份，再讀 `CLAUDE.md`（業主的永久規則）。更細的歷史紀錄在 `docs/v2-handoff.md`（依日期往下加，最新的在最後）。

## 一、業主與溝通
- 業主是程式小白，技術決定交給開發者；回覆用台灣繁體中文、白話、先講結果。
- 業主的 Google 帳號是會員中心的超級管理員，也是行動大學的管理員。
- 用語：一律「報名／繳費／報名紀錄」，不用「購買／付款／訂單」。
- 未驗證的事不能說完成；需要業主登入後台時，寫清楚「在哪一頁填什麼」。不要請業主把金鑰貼進對話。

## 二、現況（全部已上線）
- 正式站：https://learn.hglobal1985.com（Cloudflare Worker `learn` ＋ D1 `learn-v2`）。隱私權 `/privacy`、客服 `/support` 由 Worker `learn-legal` 提供。
- 程式：repo `hglobal1985/learn`，主分支 `main`（開發分支 `claude/eloquent-lamport-lhqvik` 與 main 同步）。
  - `apps/launch`：後端 API（`/api/v2/*`）＋把網頁版打包進 Worker。測試 `npm test -w @learn/launch`（37 項）。
  - `apps/mobile`：Expo App（iOS／Android／Web 共用）。`npm run typecheck -w @learn/mobile`。
  - `apps/legal`：隱私權與客服頁。`apps/api`、`apps/preview` 是舊程式，未使用。
- 已有功能：
  - Google 登入（會員中心登入中繼）、網頁版共用登入、維護中／強制更新畫面。
  - 課程管理：新增／編輯／上下架／刪除、章節、同一影片的時間軸分段、Mux 影片挑選（簽名播放）、YouTube、音檔（程式完成，等 R2）。
  - 指導單位／主辦單位標籤與篩選；限時免費；「會長也可報名」。
  - 場次：每場各自報名、繳費、審核；章節可只給某一場。
  - 報名審核：已繳費／VIP 免繳費／退回／延後再審／撤銷，快選原因、給對方留言、私人備註、完整處理紀錄。
  - 審核群組（依中心指派報名窗口／收費窗口／審核員）、依中心與職務分派通知、CSV 對帳報表。
  - 課程留言板（檢舉、封鎖、管理員隱藏）、站內通知、刪除學習資料、會員中心刪除帳號入口。
  - 商店規範：iOS／Android 不顯示價格、不能付費報名與審核（伺服器端也擋）。
- 職務與中心來自會員中心 `GET /v1/eligibility/context`（本專案請業主授權後新增，`hglobal1985/id#59`）。管理員＝超級管理員、總部秘書；會長審核自己中心；會長、音控可管理自己中心的審核群組。
- 正式站五門測試課程：會長翡翠鑽石會議、銅章會議、翡翠達標班、海外旅遊特攻營、寰宇全球菁英會（另有 6 門早期示範課程，可請業主決定是否刪除）。

## 三、部署方式
```bash
npm run build:web -w @learn/mobile
```
```bash
npm run embed -w @learn/launch
```
```bash
cd apps/launch && CLOUDFLARE_API_TOKEN=proxy-injected CLOUDFLARE_ACCOUNT_ID=650a3b03d439a5f517b4f8a28244f9fe npx wrangler d1 migrations apply learn-v2 --remote
```
```bash
cd apps/launch && CLOUDFLARE_API_TOKEN=proxy-injected CLOUDFLARE_ACCOUNT_ID=650a3b03d439a5f517b4f8a28244f9fe npx wrangler deploy
```
- 雲端工作階段的 Cloudflare 權限由環境的 network secret 注入（所以 token 填 `proxy-injected`）。
- 部署後檢查 Worker 的變數還在：`DEMO_LOGIN`、`MUX_SIGNING_KEY_ID`、`MUX_SIGNING_PRIVATE_KEY`、`MUX_TOKEN_ID`、`MUX_TOKEN_SECRET`。
- 業主在 Cloudflare 後台改變數時，可能把程式退回舊版；改完要重新部署一次。
- 正式站已關閉測試身分登入。要自動測試請在本機：複製 `wrangler.jsonc` 成 `wrangler.local.jsonc`（不提交），把 `DEMO_LOGIN` 改 `on`，`npx wrangler dev --config wrangler.local.jsonc`。
- 沒有開 PR 的流程：直接推到開發分支，再快轉 `main`（業主已同意）。

## 四、等業主處理
1. **啟用 Cloudflare R2**（音檔、附件教材要用）。啟用後：建立 bucket `learn`、`wrangler.jsonc` 加 `r2_buckets: [{ "binding": "MEDIA", "bucket_name": "learn" }]`、設定 Secret `MEDIA_URL_SECRET`、重新部署。
2. **選定寄信服務**（建議 Resend，寄件網域 hglobal1985.com），Email 通知才能做。
3. **在正式站實測**（測試登入已關，AI 無法代測）：審核群組→指派窗口→另一帳號報名付費課程→窗口審核；留言→檢舉→隱藏；Mux 影片播放。
4. 上架：需要業主的 Expo 帳號打包；Google Play 需 12 位測試者連續 14 天。上架清單見 `docs/store-listing.md`。

## 五、還沒做（依建議順序）
1. 通知方式勾選（站內／Email／手機）＋ Email 通知（Email 查會員中心，查不到可在原頁填寫並寫回會員中心）。
2. 附件教材下載（R2，短效簽名網址，只給已開通學員）。
3. 各中心自行上架課程（會長、音控可建立課程並指派審核人員）。
4. 手機推播、金流（資料欄位已預留：`orders.pay_method` 含 `online`）。
5. 會員中心串接指令 2026-11-12.5 的其餘差異：手機版共用登入（Keychain 群組）、視覺規範配色、App 內會員資料頁、串接版本回報。業主指示暫緩：「拿掉深色模式」「報名紀錄不存姓名」先不改。
6. iOS／Android 實機測試（原生分頁列、登入、播放）。

## 六、容易踩到的地方
- `apps/launch/src/api.ts` 很大（約 1500 行），所有路由都在裡面；型別契約在 `src/contract.ts`，App 端直接引用。
- D1 不能改 CHECK 條件，要改就得重建資料表；重建時注意 `ON DELETE CASCADE` 會連帶刪資料（參考 migration `0004` 的備份做法）。
- 會員中心的 `/v1/admin/*` 只接受會員中心網站自己的登入，App 的 token 一律被拒；App 要查職務只能用 `/v1/eligibility/context`。
- Amway 資料（獎銜、會員編號等）不可存；唯一例外是報名紀錄上的「中心名稱」（業主核准）。
- 會員中心 repo（`hglobal1985/id`）原則上不要動；要動先問業主，並遵守它的 `AGENTS.md`。
