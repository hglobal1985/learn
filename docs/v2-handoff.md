# 寰宇行動大學 V2 交接文件（2026-11-11）

分支：`claude/kind-dirac-3shqqo`（repo：hglobal1985/learn）。請從這份文件接手，不需要重問業主已決定的事。

## 業主已決定（不要再問）
- 使用者是程式小白，技術決定全部交給開發者；回覆使用台灣繁體中文，用白話說明。
- 目前是內部測試，`learn.hglobal1985.com` 可任意修改，不必保留測試站。
- **技術：Expo + React Native + Expo Router + TypeScript（strict），iOS / Android / Web 共用一套程式。首要目標是 App 上架後流暢。** 不強制仿 Shifu 網頁，只取用其好用的動線（找課、領課、我的課程、播放、通知）。
- 不做：LINE 通知、首頁輪播。
- 課程可設定最低獎銜限制（現階段用模擬資料，不串中央會員，但保留介面）。
- 0 元課程免審核，領取即開通。付費課程：不接金流，結帳後建立「待審核訂單」，站內通知管理員，管理員人工確認收款後開通。
- 主選單要有「站內通知」。
- **Apple/Google 規定：付費購買與人工審核流程只放 Web 版。iOS/Android 不顯示價格、購買按鈕或外部付款連結，只讓已開通的學員觀看；0 元課程三平台都可領。**
- 中央會員、Mux 簽名播放、YouTube：UI 完成後再重做串接。業主同意舊的串接可以刪（程式碼已保留在 git 歷史，Cloudflare 上目前沒有 learn 的 Secrets 與 D1）。
- 資料表要依標準規範重新設計；不要碰中央會員系統（`id.hglobal1985.com`、D1 `hglobal-id*`）。
- Google Play 為個人帳號，建立於 2023-11-13 之後：上架前需 12 位測試者連續封閉測試 14 天，須盡早出 Android 測試版。Apple 帳號也已有。

## 已完成
- 客服信箱：`service@hglobal1985.com` 轉寄到 `hglobal1985@gmail.com`（Cloudflare Email Routing），並已用 Gmail 設定可以該地址寄信，名稱「寰宇全球」。業主需自己在 Gmail 建篩選器避免轉寄信進垃圾匣。
- 隱私政策：https://learn.hglobal1985.com/privacy（獨立 Worker `learn-legal`，原始碼 `apps/legal/`，路由 `learn.hglobal1985.com/privacy*`）。內文中「帳號刪除導向中央會員官方流程」尚未實作，上架前必須完成。
- V2 領課／訂單／通知／獎銜邏輯與測試已搬到 `apps/mobile/src/domain/`（來源：`feat/web-v2-mobile` 分支的 `apps/web-v2/src/domain.ts`，PR #10 草稿）。
- 舊畫面已移到 `apps/mobile/legacy-app/`（保留不刪）；`apps/mobile/app/` 目前是空的，已執行 `npm install`。

## 現況與風險
- `learn.hglobal1985.com` 目前部署的是 PR #10 的 Vite 網頁版 V2（靜態檔，Worker `learn` 無綁定、無 Secrets），`/v1/*` 回傳網頁而非 API，所以舊版後端 API 在此網域已不存在。
- repo 的 CI 只做檢查，不自動部署；部署是手動。Cloudflare 帳號 `650a3b03d439a5f517b4f8a28244f9fe`（hglobal1985@gmail.com）擁有網域 zone `1c9558ed07ec981a87ff0f9a005ec9c4`。
- 後端有兩套：`apps/api`（TypeScript，品質好但未上線）與 `apps/launch/worker.mjs`（舊正式站，含中央會員與 Mux）。決定：以 `apps/launch` 為基礎重整，必要邏輯併入，重複者移除。
- 部署路徑尚未建立：Expo Web 輸出要如何部署到 `learn` Worker（靜態資源）需要決定並驗證。

## 下一步（依序）
1. ✅ 在 `apps/mobile` 建立導覽（底部分頁：首頁、課程、我的課程、通知、我的）與設計系統。（2026-11-11 完成，見下方「第 1 步完成紀錄」）
2. ✅ 畫面：課程列表／詳情、領課／結帳、訂單、通知、學習播放（先用示範播放器）、我的學習、管理員訂單審核與課程獎銜設定、模擬登入。
3. ✅ 付費流程以平台判斷：Web 顯示，iOS/Android 隱藏。
4. ✅ 後端：重新設計資料表，新增課程、章節、獎銜、訂單、通知 API。
5. ✅（程式完成，待實機與金鑰）中央會員、Mux 簽名播放、YouTube、帳號刪除入口、上架資料。
6. 部署驗證：實際用瀏覽器與裝置測試後，才宣稱完成。

## 注意
- 未驗證不可宣稱完成；模擬資料要明確標示。
- 不要在對話或程式碼中放任何金鑰。

## 第 1 步完成紀錄（2026-11-11）
- 導覽：`app/(tabs)/_layout.tsx` 在 iOS/Android 用系統原生分頁列（`expo-router/native-tabs`，最流暢）；`_layout.web.tsx` 在 Web 用 JS 分頁列（原生分頁在 Web 沒有圖示）。通知分頁顯示未讀數徽章。根 `app/_layout.tsx` 是 Stack，詳情頁（`app/course/[id].tsx`）從這裡推入。
- 設計系統：`src/theme/tokens.ts`（淺色／深色色票、課程封面主題色、間距、圓角、字級、最小觸控 48）、`src/theme/theme.ts`（`useTheme`），元件在 `src/ui/`（AppText、Screen、Card、Button、Pill、Section、EmptyState、ListRow、CourseCover、SandboxBanner）。畫面不得直接寫色碼。
- 狀態：`src/state/store.tsx` 以 AsyncStorage 保存示範資料（Web 為 localStorage）；之後串 API 只換這層。
- 商店規範旗標：`src/platform/commerce.ts` 的 `paidCommerceEnabled`（只有 Web 為 true），價格標籤已依此隱藏。
- 已加 `npm run check`（型別檢查＋領域邏輯測試，4 項通過）。`domain.ts` 的 `structuredClone` 改為 JSON 複製，避免 Hermes 不支援。
- 驗證：`npx expo export --platform web` 成功；Playwright 以 iPhone 13 尺寸實測五個分頁切換、模擬登入、通知未讀徽章與已讀、課程詳情、深層連結重新整理、淺色/深色與桌機寬度，無主控台錯誤。**尚未**在 iOS/Android 實機或模擬器跑過（此環境無模擬器），原生分頁需在第一次出 Android 測試版時確認。

## 第 2～4 步完成紀錄（2026-11-11）
- 後端：`apps/launch` 已改寫為 TypeScript Worker（舊的 worker.mjs、中央會員中繼、Mux 已刪，留在 git 歷史）。`/api/v2/*` 為 API，其餘路徑提供 `apps/mobile/dist`（Expo Web 輸出，SPA）。`apps/api`、`apps/preview` 未動，未部署。
- 資料表：`apps/launch/migrations/0001_schema.sql`（ranks、courses、lessons、orders、order_items、enrollments、lesson_progress、notifications、sessions、audit_log）與 `0002_demo_seed.sql`（示範課程）。會員身分只以 `member_sub` 參照，不複製中央會員資料。
- 正式 D1：`learn-v2`（id `f1283fdd-94f1-4a43-97b4-3072d1876ced`，帳號 hglobal1985@gmail.com），兩個 migration 已套用並記錄在 `d1_migrations`，之後 `wrangler d1 migrations apply learn-v2 --remote` 會從 0003 開始。
- 登入：`POST /api/v2/auth/demo` 以三個模擬會員（測試學員／銀章學員／測試管理員）取得 Bearer token（只存 SHA-256）。**任何人都能以測試管理員登入，只適合內部測試**；串中央會員時替換 `loadSession` 與登入路由。
- 商店規範在伺服器端執行：`x-client-platform` 為 ios/android 時不回傳價格、拒絕付費訂單與審核；App 端付費頁面（購物車、訂單、審核）以 `WebOnly` 導回。
- 播放：示範影片 `apps/mobile/public/media/orientation.mp4`（原創幾何動畫），API 需已開通才給網址；Worker 為 `/media/*` 補上 Range（206），iOS Safari 需要。
- 帳號刪除：`DELETE /api/v2/me` 刪除該會員在本 App 的資料（「我的」→「刪除帳號資料」）。串中央會員後要再加上導向中央官方刪除流程。
- 測試：`npm test -w @learn/launch`（11 項，node:sqlite 模擬 D1）；Playwright 在本機 `wrangler dev` 走完整流程（免費領取→播放→完成章節→加入購物車結帳→管理員審核→學員收到通知→調整獎銜→獎銜不足被拒→刪除資料）全部通過、無主控台錯誤。
- 部署指令：`npm run deploy -w @learn/launch`（輸出 Web → `scripts/embed-static.mjs` 把 `apps/mobile/dist` 打包進 Worker → 套 migration → `wrangler deploy`）。雲端 session 的 Cloudflare 權限由環境的 network secret 注入，執行時設 `CLOUDFLARE_API_TOKEN=proxy-injected`、`CLOUDFLARE_ACCOUNT_ID=650a3b03d439a5f517b4f8a28244f9fe`。
- 為何不用 Workers Static Assets：靜態資源上傳 API 需要另一把一次性 JWT 放在 Authorization，雲端 proxy 會覆蓋成 API Token 導致 401。所以改為把網頁檔（約 1.7MB，gzip 後整個 Worker 約 830KB）打包進 Worker，由 `src/site.ts` 提供（含 SPA 回退、快取標頭、Range）。若之後改在本機部署，可以改回 assets。
- 2026-11-11 已部署：Worker `learn` 版本 `3b435814-bfaf-4218-b879-6333dcb090b7`，`learn.hglobal1985.com`（custom domain）；`/privacy` 仍由 `learn-legal` 提供（已確認）。已用 Playwright（iPhone 13 尺寸）對正式站跑完整流程全部通過、示範影片可載入、Range 回 206。
- 尚未驗證：iOS/Android 實機或模擬器（此環境沒有）。

## 第 5 步完成紀錄（2026-11-11）
- **中央會員登入**：`apps/mobile/src/api/central.ts`（依會員中心串接說明：nonce→登入中繼→`/v1/auth/google`；換發加鎖；App 用 SecureStore、Web refresh 用 sessionStorage）。Web 回傳頁 `/auth/done`、App 深層連結 `learn://auth/google`，兩者已確認會員中心接受（會導到 Google 登入頁）。業主已用 Google 帳號實測登入成功（2026-11-11）。
- **後端驗證**：`apps/launch/src/central.ts` 驗 RS256／typ／iss／aud／app_id=learn／exp，只用 `sub`。顯示名稱取自 `/v1/me/profile`；管理員＝中央「超級管理員」（以 `GET /v1/apps/learn/handoff` 確認：中央 `/v1/admin/*` 只接受會員中心網站本身的 Cookie 登入，App token 一律被拒），或 Worker 變數 `LEARN_ADMIN_SUBS` 列出的會員 ID（逗號分隔；「我的」頁會顯示自己的會員 ID）；獎銜資格用 `/v1/eligibility/check-batch`，失敗一律不符合，只做 10 分鐘記憶體快取，**不存資料庫、不寫日誌**。中央會員的 `Member.rank` 一律為 null。
- **獎銜代碼**：migration `0003_central_rank_ladder.sql` 改成中央的 33 階代碼（none 顯示為「不限獎銜」）。中央若新增獎銜，要再加 migration。
- **模擬登入開關**：`wrangler.jsonc` `vars.DEMO_LOGIN`（目前 "on"）。改 "off" 後模擬帳號 API 回 404，舊模擬 token 失效。上架前必須關閉。
- **影片**：管理員在「我的→課程設定→各堂影片」設定每堂 `demo`／`youtube`（貼網址或 ID）／`mux`（Playback ID）。學員端：YouTube 用 youtube-nocookie 內嵌（App 用 WebView）；Mux 由後端簽 6 小時 JWT 回傳 HLS 網址（expo-video 播放）。Mux 金鑰已由業主設定：`MUX_SIGNING_KEY_ID` 是 Cloudflare 後台的一般變數（`wrangler.jsonc` 設了 `keep_vars: true`，部署時不會被清掉），`MUX_SIGNING_PRIVATE_KEY` 是 Secret；私鑰支援 Mux 後台的 Base64(PKCS#1 PEM) 等格式（`src/mux.ts` `parsePrivateKey`）。正式站已確認能簽出播放網址；用真實 Mux 影片播放尚待業主測試。未設定或金鑰無效時回 503 且不洩漏 Playback ID。Chrome 桌機對 HLS 的支援要實測。
- **App 狀態**：`src/features/app-gate.tsx` 啟動與回前景查 `/v1/apps/learn/config`（paused 維護中、killed 停止、min_version 要求更新）。
- **刪除帳號**：「我的→會員中心」開 `https://id.hglobal1985.com/my/edit`（官方刪除流程）；「我的→刪除學習資料」刪本 App 資料並登出。隱私權政策與新的客服頁 `/support`（含 `#delete`）已更新部署（Worker `learn-legal`，設定檔 `apps/legal/wrangler.jsonc`）。
- **上架準備**：`apps/mobile/app.json`（版本 0.2.0、圖示、啟動畫面、加密聲明）、`apps/mobile/eas.json`（preview＝APK、production＝自動遞增）、原創圖示 `apps/mobile/assets/`。`expo prebuild` 已驗證可產生 iOS/Android 原生專案。商店文字、隱私問卷、送審備註、Google Play 12 人 14 天封閉測試步驟見 `docs/store-listing.md`。
- **品牌字樣（業主已確認）**：只有會員中心本身的畫面不顯示「寰宇」；其他 App（包含本 App）可以顯示，「寰宇行動大學」名稱維持。
- **共用登入（SSO，串接說明 3.5）**：尚未實作（選做）。

## 目前狀態與之後的工作（2026-11-11）
- 業主確認：Google 登入成功、App 名稱維持、Mux 金鑰已設定。
- 之後再做（業主指示）：iOS/Android 打包上架與 Google Play 12 人 14 天封閉測試；正式上架時關閉 `DEMO_LOGIN`、移除首頁「內部測試版」標示、換上正式課程。
- 選做：會員中心串接說明 3.5 的共用登入（SSO）。

## Mux 影片匯入（2026-11-11）
- 管理員在「各堂影片」選 Mux → 「從 Mux 選擇影片」，系統讀取 Mux 帳號內所有影片（`GET /api/v2/admin/mux/assets`，每頁 50 支、可載入更多、可搜尋），點一下就把該影片的 Signed Playback ID 與長度（分鐘無條件進位）帶入該堂。不再需要手動貼 ID。
- 只有 Signed 播放 ID、狀態 ready 的影片可以匯入；只有公開播放 ID 的影片會標示「請先在 Mux 加上 Signed 播放 ID」。縮圖用簽名金鑰簽 aud "t" 的 1 小時 token。
- 需要 Mux API 存取權杖：Cloudflare Worker `learn` 設定 `MUX_TOKEN_ID`（一般變數即可）與 `MUX_TOKEN_SECRET`（Secret）。權杖只需 Mux Video「Read」權限。未設定時清單頁會顯示設定說明，API 回 503 `mux_api_not_configured`。
- 2026-11-11 業主已設定 `MUX_TOKEN_ID`／`MUX_TOKEN_SECRET`，正式站已讀到 Mux 帳號的影片清單。
- **注意**：在 Cloudflare 後台修改變數會以「當時頁面上的版本」建立新部署；若頁面是在最近一次 `wrangler deploy` 之前開啟的，會把程式退回舊版（2026-11-11 發生過一次，已重新部署修正）。後台改完變數後，請確認 `/api/v2/admin/mux/assets` 等新功能仍正常，必要時重新 `wrangler deploy`（`keep_vars: true` 會保留後台變數，Secrets 不受影響）。

## 2026-11-12：課程管理、時間軸分段、音檔、共用登入、用語
- **用語**：一律「報名」，不用「購買」（已寫入 `CLAUDE.md`，畫面、通知、隱私權與客服頁都已改）。
- **課程管理**：管理員「我的 → 課程設定」可新增（預設未上架）／編輯（名稱、副標題、講師、分類、費用、介紹、最低獎銜、封面色）／上下架／刪除課程。已有人報名的課程不能刪，只能下架。章節可新增、改名、上下移、刪除（自動重新編號）。API：`POST/PATCH/DELETE /api/v2/admin/courses[/:id]`、`POST /admin/courses/:id/lessons`、`POST /admin/courses/:id/lessons/order`、`PATCH/DELETE /admin/lessons/:id`。
- **時間軸分段**：每堂可設定開始／結束（時分秒），長度自動計算；同一支影片可切多堂。播放器自動跳到開始、播到結束自動停止並提示（Mux／示範／音檔用自家播放器；YouTube 用內嵌 start/end 參數）。migration `0004`（重建 lessons 表時已備份並還原學習進度）。
- **Mux 播放修正**：伺服器檢查（`GET /api/v2/admin/lessons/:id/check`，畫面「播放檢查」）確認 Mux 接受簽名；問題在網頁播放器，改為網頁一律用 hls.js 播 HLS。
- **音檔（R2）**：章節可上傳音檔，分段上傳到 R2 bucket `learn`，學員以 6 小時簽名網址播放（`/api/v2/media/audio`，支援 Range）。**R2 尚未在 Cloudflare 啟用**：業主啟用後要（1）建立 bucket `learn`、（2）在 `wrangler.jsonc` 加 `r2_buckets: [{ binding: "MEDIA", bucket_name: "learn" }]`、（3）設定 Secret `MEDIA_URL_SECRET`（隨機字串）、（4）重新部署。未設定前上傳會顯示「音檔儲存空間尚未啟用」。
- **共用登入（網頁版）**：登入後通知會員中心記住此瀏覽器（adopt）；每次載入頁面（每分頁 5 分鐘節流）向會員中心詢問（check → `/auth/sso`），沒有本機登入時自動用 web-exchange 登入；登出走會員中心 `/auth/sso/logout`（登出此瀏覽器所有 App）。手機版共用 Keychain 尚未做（需要 Apple Team ID，待打包時處理）。
- **登入後回原頁**：未登入點「登入後報名」會帶 `next`，登入後回到該課程。
- **五門系列課程已上架（測試用）**：會長翡翠鑽石會議（0 元，暫以翡翠以上判斷，會長身分待定案）、銅章會議（50 元，15% 以上，已放 Mux 影片）、翡翠達標班（100 元，金章以上，已放 Mux 影片）、海外旅遊特攻營（3500 元）、寰宇全球菁英會（3500 元）。

## 2026-11-12（二）：第一批——場次、審核流程、審核群組、指導／主辦單位、報表
- **正式站關閉測試登入**（`DEMO_LOGIN: off`）。正式站只能用 Google 登入；自動化測試改在本機。
- **會員中心新增** `GET /v1/eligibility/context`（[hglobal1985/id#59](https://github.com/hglobal1985/id/pull/59)，業主授權，已部署正式）：登入者自己的職務、是否已驗證寰宇、已核准的中心。行動大學據此判斷：管理員＝超級管理員／總部秘書（或 `LEARN_ADMIN_SUBS`）；會長可審核自己中心；音控／會長可管理自己中心的審核群組。
- **資料表** migration `0005`：`course_runs`（場次）、`review_groups`／`review_group_members`（審核群組，成員依中心分列，`center_key=''` 為總窗口）、`order_events`（操作紀錄、留言、私人備註）、orders 新增中心／寰宇／延後／實收／繳費方式／撤銷欄位（預留金流：`pay_method` 已含 `online`）、courses 新增指導單位／主辦單位／限時免費／審核群組、enrollments 改為每場一筆、notifications 可寄給「某中心的會長」。
- **報名**：每門課（或每場）一筆報名紀錄。有場次的課程必須選場次（名額、截止、每場費用）。限時免費期間報名＝免費自動開通。章節可指定屬於某場（只有該場學員可看）。未登入只能看課程清單，介紹頁需登入。購物車（報名清單）已移除，改為直接報名。
- **審核**：`POST /api/v2/admin/orders/:id/review` `{action: paid|vip|reject|defer|revoke, reasonCode, message, note, paidTwd, payMethod}`。退回／延後／撤銷需選原因（款項未入帳、金額不正確、獎銜不符合、查無此人、其他）。撤銷限管理員。不能審核自己的報名。留言（雙方可見並通知）與私人備註（只有審核人員可見）：`POST /api/v2/orders/:id/events`。
- **通知分派**：付費報名通知「群組中該中心的成員（含總窗口）＋該中心會長」；非寰宇學員、沒有中心、或該中心沒有窗口時改通知總部（管理員）。管理員不收一般報名通知，改用審核清單篩選（狀態、課程、中心、姓名、只看非寰宇）。
- **指導／主辦單位**：課程卡與介紹頁同時顯示兩個標籤，課程清單可依單位篩選。指導單位為「寰宇總部」的課程只能套用總部群組（只有管理員可指派人員）。
- **報表**：`GET /api/v2/admin/orders.csv`（含 BOM，Excel 可開），範圍同審核權限：窗口＝負責的課程與中心、會長＝自己中心、管理員＝全站。
- **畫面**：我的→報名審核／審核群組／課程設定；課程編輯頁新增單位、限時免費、審核群組；章節頁新增場次管理與「屬於哪一場」。
- **修正**：連線瞬斷不再把登入清掉；「不限獎銜」不再顯示成獎銜限制標籤。
- **測試**：後端 35 項；本機瀏覽器跑完整流程（建群組→指派窗口→設定課程→加場次→學員報名→留言→窗口延後→開通→匯出）。正式站因關閉測試登入，只做了公開 API 與頁面檢查，**審核流程在正式站尚待業主以真實帳號驗證**。
- **尚未做（第二批以後）**：留言板（含檢舉）、附件教材、Email 通知與通知管道勾選、R2 音檔啟用、各中心自行上架課程（B）、手機推播、金流、手機版共用登入、App 內會員資料頁。「會長翡翠鑽石會議」目前只以翡翠以上判斷，尚未加入「會長」身分條件。

## 2026-11-12（三）：會長條件、留言板
- **會長也可報名**：課程新增 `allow_president`（課程編輯頁「報名資格」）；開啟後會長不受獎銜限制。「會長翡翠鑽石會議」已開啟（翡翠以上或會長）。
- **課程留言板**（migration `0006`）：登入會員可在課程介紹頁留言（10 分鐘內最多 5 則）、刪除自己的留言、檢舉、封鎖對方；被檢舉時通知總部一次；管理員在「我的→留言檢舉」隱藏留言或清除檢舉。刪除學習資料時一併刪除留言。
- 後端測試 37 項；本機瀏覽器測過留言→檢舉→隱藏。
- **等業主**：啟用 R2（音檔、附件教材）；選定寄信服務（Email 通知）。

## 2026-11-12（四）：R2、自己審核、Email 通知
- **R2 已綁定**：bucket `learn`、綁定 `MEDIA`（已部署）。`MEDIA_URL_SECRET` 業主已設定，音檔上傳與播放已由業主實測 OK（2026-11-12）。
- **管理員（超級管理員、總部秘書）可審核自己的報名**；會長、窗口、審核員仍不行（`reviewOrder`、`canReview`）。
- **寄信網域**：Cloudflare Email Service 子網域 `learn.hglobal1985.com` 已開通（SPF／DKIM／DMARC／退信 MX 都在 `cf-bounce.learn…`、`_dmarc.learn…` 底下，不動網站本身與主網域的 service@ 轉寄、Gmail 寄信，因為主網域會被加上 `p=reject`）。2026-11-12 由 `mail.hglobal1985.com` 改為此網域；業主確認新網域收信正常後，已刪除舊的 `mail.hglobal1985.com` 寄信子網域。寄件人 `noreply@learn.hglobal1985.com`，Worker 綁定 `EMAIL`、變數 `EMAIL_FROM`，不需任何金鑰。
- **Email 通知設計**：
  - 收件信箱＝會員中心個人資料「聯絡信箱」`contact_email`（正本在中央；行動大學已有權限，**未修改會員中心**）。
  - 登入時（`GET /me`、通知設定頁）把它同步成副本，存在 D1 `member_contacts`（migration `0007`），因為通知常寄給不在線上的人。學員在「我的 → 通知設定」改信箱時，先 `PUT /v1/me/profile/fields/contact_email` 寫回中央，成功才更新副本。刪除學習資料時整列刪除。信箱不寫稽核紀錄與日誌。
  - 寄信方式：每個寫入類 API 成功後，`flushEmails`（`src/email.ts`）把最近 30 分鐘內 `notifications.emailed_at` 為空的站內通知寄出；先標記再寄，寧可漏寄不重複寄。角色型通知（總部、某中心會長）依 `member_contacts.is_admin／president_center_key` 找收件人，這兩欄在登入時更新。站內通知永遠保留；學員可關閉 Email。
  - API：`GET／PUT /api/v2/me/notification-settings`；畫面 `app/settings/notifications.tsx`。手機推播尚未做（畫面顯示「即將推出」）。
- 後端測試 41 項（新增 `tests/email.test.ts`）。
- **業主已實測（2026-11-12）**：真實帳號填信箱後，會員中心的聯絡信箱有同步改；另一個帳號報名付費課程後，有收到通知信。尚未驗證：信是否進垃圾信匣、各種通知（審核結果、留言、會長通知）的信件內容。沒登入過新版的人還沒有信箱副本，暫時收不到 Email。

- **待中央確認（2026-11-12）**：行動大學保存的個人資料副本（聯絡信箱、顯示名稱、報名時的中心名稱）尚未取得會員中心端對《隱私同意文字》的書面確認，也還沒有「會員在會員中心刪帳號時通知行動大學刪副本」的機制；業主將轉請中央會員 AI 評估。

## 2026-11-12（五）：附件教材
- 管理員在「課程設定 → 章節」每堂可上傳多個附件（PDF、Word、PowerPoint、Excel、CSV、文字、ZIP、PNG、JPG；單檔 50MB、每章 20 個）；學員在上課頁「附件教材」下載。
- 檔案放 R2（鍵 `files/<章節>/<uuid>.<副檔名>`），清單在 D1 `lesson_attachments`（migration `0008`）。下載用 1 小時有效的簽名網址（`GET /api/v2/media/file`，簽章用 `MEDIA_URL_SECRET`），只有已開通該場／該課的學員與管理員拿得到；一律以附件下載、`nosniff`。刪除附件、章節、課程時一併刪 R2 檔。
- API：`GET /courses/:cid/lessons/:lid/attachments`、`GET／PUT /admin/lessons/:id/attachments?name=`、`DELETE /admin/attachments/:id`。
- 後端測試 42 項；已部署。**待業主實測**：上傳附件、用已開通帳號下載、未開通帳號看不到。
- **網址附件（同日）**：附件除了上傳檔案，也可新增 https 網址（migration `0009`，`lesson_attachments` 重建，新增 `kind`／`link_url`／`att_type`）。伺服器依網域／副檔名自動判斷類型（`src/links.ts`）：YouTube、Vimeo、Canva、Google 簡報／文件／試算表／表單／雲端硬碟、Notion、PDF、一般網頁；上傳檔案依副檔名（PDF／Word／PowerPoint／Excel／壓縮檔／圖片／文字）。畫面依類型顯示圖示（`src/features/attachments.tsx`）。標題可自訂（空白＝依類型自動命名；上傳檔案空白＝檔名），可修改標題與網址。API：`POST /admin/lessons/:id/links`、`PATCH /admin/attachments/:id`；上傳檔案可加 `&title=`。只收 https、不收帶帳密的網址；網址附件只有已開通學員與管理員拿得到。後端測試 43 項。待業主實測。

## 2026-11-12（六）：刪除已有人報名的課程
- 課程編輯頁「刪除課程」：沒有人報名照舊（一般確認即可）；**已有報名紀錄時**先顯示影響（報名筆數、待審核／已開通、學員數、已確認收款合計），管理員必須**手動輸入大寫 `YES`** 才能刪除。伺服器同樣強制：`DELETE /api/v2/admin/courses/:id` 需帶 `{"confirm":"YES"}`，否則回 409 `confirm_required`；`GET /api/v2/admin/courses/:id/delete-impact` 提供統計。
- 刪除內容：該課程的章節、附件與音檔（R2 一併刪）、場次、留言、學習進度、開通紀錄；只含這門課的報名紀錄整筆刪除（含處理紀錄與指向它的通知）；同一筆報名還有別門課時，只移除這門課並扣掉金額。**報名與繳費審核紀錄刪除後無法復原**，畫面建議先匯出 CSV 對帳報表。稽核紀錄 `course.delete` 保留刪除統計（課名、筆數、人數、收款合計），不含個資。
- 後端測試 44 項；已部署，待業主實測。

## 2026-11-12（七）：底部分頁列永遠顯示
- 底部分頁列（首頁／課程／我的課程／通知／我的）改成根版面的 `BottomBar`（`apps/mobile/src/ui/bottom-bar.tsx`），**所有頁面都顯示**：課程介紹、上課、我的報名、報名審核、課程設定、通知設定等推入的頁面不再蓋掉它。點分頁會回到該分頁；目前頁面所屬分頁會標示（課程介紹→課程、上課→我的課程、報名／管理／設定→我的）。登入中繼頁（`/auth/*`）與手機鍵盤開啟時隱藏。
- `(tabs)/_layout.tsx` 只負責切換內容（`tabBar` 隱藏），已移除 iOS／Android 原生分頁列與 Web 版 `_layout.web.tsx`。**取捨**：iOS／Android 不再是系統原生分頁列外觀（改為與網頁相同的自製分頁列），換來所有頁面一致、永遠看得到。
- 驗證：本機瀏覽器（手機寬度）逐頁檢查 9 個頁面，分頁列都固定在底部、捲動不消失，點分頁導覽正確；**iOS／Android 實機尚未測**。

## 2026-11-12（八）：刪除已有人報名的場次
- 課程設定 → 章節與影片 → 「場次」的「刪除」：沒人報名照舊直接刪；**已有報名紀錄時**顯示影響（報名筆數、待審核／已開通、學員數、已確認收款合計、只屬於這個場次的章節數），必須手動輸入大寫 `YES`。API：`GET /admin/runs/:id/delete-impact`、`DELETE /admin/runs/:id`（有報名需帶 `{"confirm":"YES"}`，否則 409 `confirm_required`）。
- 一併刪除：這個場次的報名紀錄（含處理紀錄與相關通知）、開通紀錄、學習進度、**只屬於這個場次的章節**（含附件、音檔）；同一筆報名還有別場或別課時只移除這個場次並扣金額。別的場次不受影響。稽核紀錄 `run.delete` 保留統計。
- 先前（七）的「刪除課程」流程不變。後端測試 45 項；順手修正兩個簽名竄改測試偶發失敗（隨機簽章第一碼剛好等於 X）。待業主實測。

## 2026-11-12（九）：「我的」頁面頁尾
- 移除「我的」頁面「其他」分類的三個項目（隱私權政策、客服與說明、聯絡客服）。公開頁 `/privacy`、`/support` 仍由 Worker `learn-legal` 提供（商店上架填的隱私權政策網址與客服網址不變）。
- 改為與寰宇中央會員網站相同的頁尾（`id` repo `src/web/layout.ts` 的 `footer.foot`）：左邊「隱私權政策」連結、右邊「系統設計 杜杜龍」署名；14px，連結色 `#5d6b62`、署名色 `#cfd2c9`（深色模式用等比例的淡化色）。**只放在「我的」頁面最下方**（`app/(tabs)/me.tsx` 的 `SiteFooter`），其他頁面不顯示。已用正式站瀏覽器量測顏色與字級相符。
- **待業主決定**：隱私權政策內文（`apps/legal/privacy.html`）尚未提到「聯絡信箱副本」與「Email 通知」；需補寫並更新日期，內文由業主核准。

## 2026-11-12（十）：課程海報（EDM）與封面圖（第一批）、隱私權政策補充
- **修正**：課程編輯頁（`admin/course-edit.tsx`）的「刪除確認」Hook 放在提前 `return` 之後，載入課程後會當掉（React error #310）。已移到最上方；這個錯誤從「刪除已有人報名的課程」那次部署起存在，本次一併修正。**之後新增 `useState`／`useEffect` 一律放在元件最上方、所有提前 return 之前。**
- **EDM 與封面**（migration `0010`）：課程編輯頁（網頁版）新增「海報（EDM）與封面」：
  - 上傳直式 EDM → 自動合成 16:9 封面（1024×576）。可自訂裁切（拖曳框與四角）或勾「不裁切」；底圖從圖庫選或自行上傳。也可「直接上傳橫式封面圖」（鎖定 16:9 裁切）。
  - 格式 JPG／PNG／WebP／**HEIC（`heic2any` 在瀏覽器內轉檔）**，單張輸入 20MB 內；**在瀏覽器內壓縮、不保留原始檔**：EDM 長邊 2048px、封面與底圖長邊 1024px。伺服器只收處理好的圖，並以檔頭驗證格式（EDM 8MB、封面與底圖 3MB 以內）。
  - **公開**：EDM 與封面走 `GET /api/v2/media/pub?k=…`（無需登入、只服務資料庫仍在使用的檔案、永久快取，換圖會換檔名）。課程介紹頁顯示 EDM（網頁 `<img>` 可右鍵另存／長按；App 提供「開啟原圖」）。課程卡與介紹頁封面改用圖片，沒有圖片時維持色塊。
  - **底圖圖庫**（`cover_backgrounds`）：內建 5 張原創漸層底圖（R2 `bg/builtin-1..5.jpg`）＋自訂上傳。**只有具課程編輯權限的人**開啟圖庫時才看得到，並顯示「上傳者姓名・中心」（簽名網址 `GET /api/v2/media/img`）。管理員（超級管理員、總部秘書）可隱藏／刪除；內建底圖與使用中的底圖只能隱藏。不做檢舉。
  - **權限**：`requireCourseArt`：超級管理員、總部秘書不限；會長、音控只能編輯主辦單位是自己中心的課程（`courses.host_center_key`）。**目前只有後端與測試完成這條規則**；會長、音控還沒有進入課程設定的畫面入口，等「各中心自行上架課程」時一起做。
  - 刪除課程時一併刪 EDM、封面。
  - 後端測試 46 項；本機用瀏覽器測過：上傳、裁切拖曳（含 16:9 鎖定縮放）、HEIC 轉檔、合成封面、課卡與介紹頁顯示。**iOS／Android 實機的圖片上傳尚未做**（裁切與合成只在網頁版，手機版顯示提示）。
- **隱私權政策**（`apps/legal/privacy.html`，已部署 `learn-legal`）：補寫「聯絡信箱副本與 Email 通知」「管理人員上傳素材的上傳者資訊」，更新日期為 2026-11-12；版面不變。

## 2026-11-12（十一）：底部選單改名、首頁改版、跑馬燈公告
- **手機優先**：已寫入 `CLAUDE.md`（業主永久指示）。新畫面一律先以手機寬度（約 390px）設計與驗證。
- **底部選單改名**：課程→「全部課程」、我的課程→「已報名」、我的→「設定」（路由仍是 `/courses`、`/learning`、`/me`）。頁面標題、隱私權政策與客服頁、商店文案、Email 頁尾的路徑文字一併改為「設定」。
- **首頁改版**（`app/(tabs)/index.tsx`）：固定一頁、不上下捲動。上方標題與跑馬燈，下方左右兩個區塊——左「繼續學習」（已報名課程）、右「推薦課程」（只顯示符合會員獎銜〔含會長〕、已上架且尚未報名的課程）。每個區塊是 16:9 的橫向輪播（`features/courses/home-rail.tsx`），在區塊內左右滑動切換；圖用課程封面（EDM 合成的 16:9 圖），沒有封面就用課程名稱當封面；圖下方顯示課程名稱與講師／進度，點圖或名稱進入課程。沒登入時兩區塊顯示登入提示。
- **跑馬燈公告**（migration `0011`，`announcements` 資料表）：取代首頁「內部測試版」提示。多則公告每 4 秒自動上下輪播（`src/ui/ticker.tsx`），手指上下滑動可快速查看（滑動後暫停自動輪播 8 秒）；沒有啟用中的公告時首頁不顯示。公開 `GET /api/v2/announcements`；管理 `GET／POST／PATCH／DELETE /api/v2/admin/announcements`、`POST /admin/announcements/order`（僅超級管理員與總部秘書）。管理畫面在「設定 → 管理」第一項「跑馬燈公告」（新增、編輯、停用、上下移、刪除，每則 120 字內、最多 30 則）。**目前沒有任何公告**（舊的「內部測試版」文字不再適用），請業主新增。
- 後端測試 47 項；本機以手機寬度瀏覽器驗證：首頁無捲動、跑馬燈自動輪播與上下滑動、區塊左右滑動、管理畫面。**iOS／Android 實機的手勢尚未測。**
- **首頁微調（同日）**：左右兩欄改直式，只顯示 EDM 本身（5:7 直式框，最高 340px；沒有 EDM 就用課程名稱當封面，不再用橫式底圖）。大標題「寰宇行動大學」與其他頁面標題同大（display）並置中；第二行置中顯示會員頭像＋姓名（放大），點擊開啟中央會員個人中心的基本資料編輯頁（模擬會員不可點）。頭像網址來自會員中心 `/v1/me/profile` 的 `avatar.url`（公開頭像，只放記憶體快取、不存資料庫）。跑馬燈改用與「已報名」頁淡黃色提示相同的顏色（`warningSoft`／`warning`）。
- **獎銜未顯示**：業主要求在姓名旁顯示獎銜，但獎銜屬 Amway 資料，隱私權政策與 `CLAUDE.md` 規定 App 不取得、不保存、不顯示；需業主與中央會員評估後才能做（見交接對話）。
- **首頁（十二）**：標題旁放寰宇 Global 標誌（`assets/logo.png`）；姓名旁顯示獎銜（`Member.rankLabel`，取自會員中心 `GET /v1/me/amway` 的 `rank`，業主 2026-11-12 永久授權讀取；只放記憶體快取，不存資料庫；獎銜為「無」或沒填顯示「安麗寶寶」；框色同中央會員 `.rank`：底 #fdf0e3、框 #e6c48c、字 #cc6c0c 粗體），姓名不加粗。兩區塊標題右側的「已報名／全部課程」連結已刪除；左區塊標題下方顯示隨機學習金句（`GET /quotes/random`，每次進入首頁換一則；管理：設定→管理→「編輯學習金句」，**僅超級管理員**，秘書沒有權限；migration `0012`），右區塊標題下方顯示「只顯示符合獎銜資格的課程」。EDM 下方課程名稱後增加：主辦單位（指導單位不顯示，依「、，;」拆成多個）、日期（最近一場的開課日，`nextRunAt`）、金額（遵守商店規範：iOS／Android 不顯示價格）。
- **待確認**：（1）會員中心 `rank` 的值格式未驗證（程式依「獎銜代碼對照本 App 的獎銜階梯名稱，對不到就顯示原值」處理）；（2）隱私權政策目前仍寫「不取得獎銜」，需業主改寫（獎銜只在首頁顯示、不保存）；（3）iOS／Android 實機未測。
