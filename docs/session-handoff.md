# 寰宇行動大學：新對話交接包（更新於 2026-11-13）

給接手的 AI：先讀這份，再讀 `CLAUDE.md`（業主的永久規則）。完整歷史在 `docs/v2-handoff.md`（依日期往下加，最新在最後）。

## 一、業主與溝通
- 業主是程式小白；回覆用**台灣繁體中文、白話、先講結果**。業主有時用簡體字或打錯字：**畫面文字與欄位實際用途不一致時要主動提醒**（例如「本姓」其實是「本名」）。
- **永久規則**（`CLAUDE.md`）：一律「報名課程／繳費／報名紀錄」，不用購買／付款／訂單；**手機 UI 優先**（先用約 390px 手機寬度設計與驗證，回報時說明手機怎麼操作）；封測階段**不建 staging**（直接本機測試＋正式部署，正式上架後才改成先測試再部署）；全生態系**統一配色**（`docs/hglobal-color-standard.md`、`docs/hglobal-tokens.json`）；不在對話或 repo 放任何金鑰。
- 未驗證的事不能說完成；沒有真實帳號可測時要老實說「只用模擬資料看過版面」。

## 二、現況（全部已上線）
- 正式站：https://learn.hglobal1985.com（Worker `learn`＋D1 `learn-v2`＋R2 `learn`）；`/privacy`、`/support` 由 Worker `learn-legal`（`apps/legal`）提供。
- 程式在 repo `hglobal1985/learn` 的開發分支 **`ccr-8555db5d-ggc3bl`（已推送、領先 main 很多）**；**`main` 還沒更新**（過去業主同意「推開發分支再快轉 main」，下次要快轉請先問一次）。後端測試 48 項（`npm test -w @learn/launch`），App 型別檢查 `npm run typecheck -w @learn/mobile`。
- 主要功能（細節都在 `v2-handoff.md`）：Google 登入＋網頁共用登入；課程／場次／章節／Mux／YouTube／音檔；**附件教材（檔案＋網址，自動判斷類型與圖示）**；**EDM 與封面（網頁版裁切、底圖圖庫、HEIC）**；活動日期；報名審核（審核群組、付款代碼、會員 ID、真實姓名快照、CSV）；留言板；**Email 通知（Cloudflare Email Service，寄件 `noreply@learn.hglobal1985.com`）**；**首頁**（寰宇 logo＋流動變色反光標題、跑馬燈公告可關閉、左右兩欄 EDM 輪播、骨架畫面）；**學習金句（超級管理員可編輯）**；**「完善資料」小視窗**（直接寫回中央：本名、暱稱、Email、系統、中心、獎銜，依中央串接指令 2026-11-13.9 規則）；底部分頁列永遠顯示（首頁／全部課程／已報名／通知／設定）；App 圖示＝學士帽（`apps/mobile/scripts/make-icon.py` 產生，首頁標題旁仍用寰宇 logo）；刪除已有人報名的課程／場次（輸入 YES）。
- 角色：管理員＝超級管理員、總部秘書；學習金句只有超級管理員；會長、音控只能（後端規則已有）編輯主辦單位是自己中心的課程圖片，**尚無畫面入口**。

## 三、部署（雲端環境用 proxy 注入的 Cloudflare 權限）
```bash
cd /home/user/learn
npm run build:web -w @learn/mobile && npm run embed -w @learn/launch
export CLOUDFLARE_API_TOKEN=proxy-injected CLOUDFLARE_ACCOUNT_ID=650a3b03d439a5f517b4f8a28244f9fe
cd apps/launch && npx wrangler d1 migrations apply learn-v2 --remote   # 有新 migration 才需要（目前到 0017）
npx wrangler deploy
cd ../legal && npx wrangler deploy                                      # 只有改隱私權／客服頁才需要
```
- 部署後確認三個 Secret 還在：`npx wrangler secret list`（`MEDIA_URL_SECRET`、`MUX_SIGNING_PRIVATE_KEY`、`MUX_TOKEN_SECRET`）。業主在 Cloudflare 後台改變數會把程式退回舊版，改完要重新部署。
- Cloudflare 偶爾回「請求太頻繁（code 971）」要等約 4 分鐘再 `wrangler deploy`。
- **本機測試**：複製 `apps/launch/wrangler.jsonc` 成 `wrangler.local.jsonc`（已 gitignore；把 `DEMO_LOGIN` 改 `on`、加 `MEDIA_URL_SECRET`、拿掉 routes），`npx wrangler d1 migrations apply learn-v2 --local --config wrangler.local.jsonc`，`wrangler dev --port 8799`；用 Playwright（已內建 chromium）手機寬度截圖。中央會員資料用 Playwright 攔截 API 模擬（`/me` 補 `profileForm`、`/me/vocab`）。測完刪掉 `wrangler.local.jsonc` 與 `.wrangler/state`。

## 四、等業主回覆／決定
1. **中央新標準（串接指令 2026-11-12.10）**：聯絡查詢用途 `payment_notice`、`course_notice` 要不要核准（業主尚未回覆）；配色例外已決定「不例外、全統一」。中央已有 webhook、`contacts/lookup`、最小 scope，行動大學**尚未接**：要做 webhook 接收端（`CENTRAL_WEBHOOK_SECRET`）、改成寄信時向中央查信箱（`CENTRAL_SERVICE_SECRET`，用完即丟、清掉 `member_contacts.email` 副本）、版本與標準符合度回報（`handoff?integrated=2026-11-13.9&standards=…`）。因不建 staging，先本機用模擬中央測試，業主在中央後台建 production 金鑰後才接真實事件。**scope 收緊時必須保留 `profile.basic.write`、`amway.write`、`amway.read`、`profile.contact.write`（資料補填視窗要寫入）。**
2. 中央新增 `icon_url`：行動大學圖示網址 `https://learn.hglobal1985.com/icon-512.png`（業主已被給予貼給中央的指令）。
3. 學習金句目前 22 則（20 則是業主給的，另 2 則業主自己加的）。
4. 資料補填視窗與整個畫面**還沒用真實帳號完整實測**（業主只用截圖回饋）；iOS／Android 實機、App Store／Google Play 上架（需 Apple Team ID、Expo 帳號）尚未做。

## 五、還沒做（建議順序）
1. 中央新標準接入（上面第 1 項）。
2. 各中心自行上架課程（會長、音控的課程設定入口與權限）。
3. EDM 裁切／上傳在手機 App 的支援（目前只有網頁版；裁切控制點對手指偏小）。
4. 手機推播、金流（`orders.pay_method` 已含 `online`；付款代碼 `pay_ref` 已有）。
5. 首頁速度：已做串列等待優化（共用登入檢查改背景、同資料只問中央一次、視窗資料隨 `/me` 帶回）；若仍慢，可評估 Cloudflare Cache 共用中央查詢結果（要考慮隱私）或單一 `/home` 彙整 API。回應有 `Server-Timing` 可量測。

## 六、容易踩到的地方
- `apps/launch/src/api.ts` 很大，路由都在裡面；型別在 `src/contract.ts`（App 直接引用）。
- **React Hook 一律放在元件最上方、所有提前 return 之前**（曾因此讓課程編輯頁當機）。
- D1 不能改 CHECK／NOT NULL，要改只能重建資料表（參考 migration 0004、0009）。
- 中央 `/v1/admin/*` 只接受會員中心網站自己的登入；App 只能用本人 Token 呼叫中央（`/v1/me/*`、`/v1/eligibility/*`、`/v1/vocab/*`、`/v1/amway/field-definitions`）。
- Amway 資料（獎銜、系統、中心）**只即時讀寫中央、不保存**；唯一例外是報名紀錄上的「中心名稱」（業主核准）。真實姓名只在付費報名時存快照（`orders.legal_name`，業主核准），Email 目前有一份通知用副本（`member_contacts.email`，之後要改成寄信時查詢）。
- 中央會員系統（`hglobal1985/id`）**原則上不要改**；需要中央改動時，請業主把需求貼給中央會員 AI（給業主寫好可貼上的指令）。
- 畫面文字的簡繁與用字：台灣繁體；「對帳」（不是對賬）、「報名課程」。
