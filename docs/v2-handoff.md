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
- **（十三）課程畫面與首頁**：課程新增「活動日期」（migration `0013`：`event_start`／`event_end`，最多連續 3 天；課程編輯頁「活動日期」欄位，格式 2026-12-01），顯示在課程介紹頁分鐘數旁與首頁課程資訊。移除課程介紹頁「課程海報（EDM）」區塊與小字備註，改為**點封面橫幅開啟 EDM 原圖**。首頁：大標題 `BrandTitle`（logo 色系逐字色彩流動＋彈跳動畫、logo 呼吸）；跑馬燈右上角大 X 可關閉，每次進入首頁會再顯示；左右兩欄標題置中、加色彩膠囊與圖示，備註置中；EDM 填滿框、靠上對齊（只裁下方與左右，不裁上方）。
- **未做、待討論**：（1）會員資料補填彈窗（真實姓名、Email、Amway 完整欄位）；（2）中央會員網站跟隨系統深色模式（要改 `hglobal1985/id`，需轉給中央會員 AI）。
- **（十四）會員資料補填彈窗**：登入後，若會員中心資料有空白（聯絡信箱；勾選「我是 Amway 會員」時 Amway 欄位有空白），首頁彈出視窗（`features/profile-prompt.tsx`，約 70%×70%、可捲動、右上大 X），一律引導到中央會員編輯頁填寫，**不在行動大學收集任何資料**（業主決定）。每次登入彈一次；`GET /me` 回傳 `member.profileMissing`（只有「缺什麼」，不保存內容）。**真實姓名**：業主決定要恢復（付費課程對帳金流用途），需中央會員先恢復欄位後，才能把「真實姓名」加入缺漏檢查與對帳；Amway 欄位判斷是「任一欄位值與待審值皆空白」，實際必填規則待與中央對照。

## 2026-11-13：串接指令 2026-11-12.8 差異（中央會員回覆）
- **中央 staging**：`https://hglobal-id-staging.hglobal1985-static.workers.dev`（JWKS `/oauth/jwks`）；`app_id=learn` 已登記，web_origins `https://learn.hglobal1985.com`、return_urls `learn://auth/google`，**不含 localhost**（網頁測試要提供 https 預覽網址由中央補登記；手機測試用 `learn://`）。staging 沒有會員，需業主先登入一次並由中央加超級管理員，才能測 `handoff?integrated=`。**在中央 production 部署前，行動大學只能用 staging 測試版本回報。**
- **已做（本日）**：（B）獎銜名稱改向中央 `GET /v1/amway/field-definitions`（key=rank 的 options）讀取，快取 1 天、只放記憶體；讀不到時退回本地階梯名稱；值為 `null` 或 `"none"` 一律顯示「安麗寶寶」。（C）隱私權政策更正：登入時讀取本人獎銜只暫存記憶體供首頁顯示，不保存、不顯示給其他會員（中央確認不需新增同意文字）。
- **未做、等業主決定**：（A）版本回報 `handoff?integrated=2026-11-12.8`（需 staging 測試帳號與可設定的中央網址環境變數）；`legal_name`（真實姓名，`GET /v1/me/profile` 的 `fields.legal_name.value`）要用於付費課程對帳——中央規定「不存進 App 資料庫」，但審核人員無法用自己的 token 讀別人的姓名，**對帳要不要在報名紀錄保存姓名快照需業主明確核准**；共用 Keychain（需同一 Apple 開發者帳號；群組 `$(AppIdentifierPrefix)com.hglobal1985.shared`、鍵名 `hglobal.sso`，測試版建議 `hglobal.sso.staging`）。
- **（2026-11-13 業主核准）真實姓名快照**（migration `0014`，`orders.legal_name`）：**付費課程**報名當下讀取會員本人在中央的 `legal_name`（`GET /v1/me/profile`），存成快照供對帳；免費課程不存；沒填真實姓名時付費報名會被擋下（409 `legal_name_required`，提示到會員中心填寫）。顯示：本人的報名紀錄、審核清單／明細（`Order.legalName`）、CSV 對帳報表「真實姓名（對帳）」欄；刪除學習資料時隨報名紀錄刪除。首頁資料補填彈窗的缺漏檢查加入「真實姓名」。不寫進日誌。
- **獎銜是公開資料（業主決定）**：隱私權政策已改為「獎銜在會員中心屬公開資料；本服務只暫存本人獎銜於記憶體供首頁顯示」。目前只顯示本人；若日後要顯示其他會員的獎銜，須讀取對方的公開資料並遵守中央的公開設定（中央欄位另有 public／private 可選），需另行討論。

## 2026-11-13：對帳標準化（付款代碼、會員 ID、查看紀錄）
- **付款代碼**（migration `0015`，`orders.pay_ref`）：每筆付費報名一組唯一代碼 `P`＋8 碼；學員的待審核報名顯示「匯款備註請填付款代碼」；審核清單、明細、搜尋（可輸入代碼或會員 ID）、CSV 報表都有「付款代碼」與「會員 ID」欄。**對帳以付款代碼為準，姓名只是輔助。** 既有付費報名已補代碼。
- **查看紀錄**：審核人員（非本人）開啟有真實姓名的報名明細，會寫入稽核紀錄 `order.view_legal_name`（只記誰、哪一筆，不記姓名內容）。
- **與中央配合、待中央實作**：事件通知（會員改名／改信箱／刪帳號 webhook）、App 對 App 受限查詢聯絡信箱（取代信箱副本）、依 App 分配最小權限。指令已交給業主轉中央會員 AI；中央完成後行動大學再接。
- **學習金句詞庫（2026-11-13）**：migration `0016` 寫入業主提供的 11 句初始金句（業主說 20 句，實際貼了 11 句，其餘待補）；超級管理員可在「設定→管理→編輯學習金句」新增、**修改**（新增 `PATCH /admin/quotes/:id`）、刪除；首頁每次進入隨機顯示一則。
- **學習金句（更新）**：改為業主提供的 20 句（migration `0017`，移除先前內建的 11 句；業主自己新增的不動）。
- **（2026-11-13 更正）真實姓名改為非必填**：不再列入首頁資料補填提醒，付費報名也不再因為沒填而被擋（有填就存快照，沒填則為空；對帳以付款代碼為準）。資料補填提醒的 Amway 檢查改為只看核心三欄（培訓系統、地區教育中心、獎銜）；推薦人與上手欄位因人而異，不列入。Email 有填就不會提醒。
- **（2026-11-13）Email 不再列入資料補填提醒**：會員用 Google 登入，信箱應由中央預設帶入 Google 信箱（行動大學讀不到 Google 信箱：`/oauth/userinfo` 沒有 email）。已請中央實作預設帶入與備援查詢；完成前，沒填聯絡信箱的會員收不到 Email 通知（站內通知照常）。

## 2026-11-13：App 圖示與標題反光
- **App 圖示**：以寰宇 logo 為固定圖案。網頁：`/favicon.ico`、`/favicon-32.png`、`/apple-touch-icon.png`（180）、`/icon-192.png`、`/icon-512.png`、`/icon-maskable-512.png`、`/manifest.webmanifest`（名稱「寰宇行動大學」、主題色 #2F5D3A、standalone），加到主畫面時使用同一圖案；`<link>` 標籤由 `apps/launch/scripts/embed-static.mjs` 在打包時補進 `index.html`。原生 App 圖示（`assets/icon.png`、`adaptive-icon.png`，Android 背景改白）與商店圖示同步。**中央會員的 App 捷徑要顯示相同圖示：圖示網址固定為 `https://learn.hglobal1985.com/icon-512.png`（需要中央登記 App 時提供圖示欄位）。**
- **首頁標題**：移除逐字跳動，改為「反光」——文字顏色沿 logo 色系流動，並週期性（4.2 秒）掃過一道由左到右的亮光（淺色模式亮金、深色模式白光，含光暈），logo 同步呼吸；沒有位移。
- **（2026-11-13 業主決定）封測階段不建立 staging**：行動大學直接本機測試＋正式部署；正式上架 App Store／Google Play 後，才改成「每次修改先 staging 再 production」。中央串接新標準（webhook、聯絡查詢）因此改為：本機以模擬中央測試，業主在中央後台建立 production 金鑰後再接真實事件。
- **（更正）App 專屬圖示＝學士帽**：不再使用寰宇 logo。設計：深綠漸層圓角方形底、奶油色學士帽（橘色帽身）、金黃流蘇、一圈金→橘→鮭粉的環繞軌道弧線（呼應寰宇 logo 的環），配色取自寰宇 logo 與網站主色。由 `apps/mobile/scripts/make-icon.py`（Pillow）產生並覆蓋 `assets/`（icon、adaptive-icon、favicon、首頁標題旁的 `logo.png`）與 `public/`（網頁圖示、遮罩圖示）；要改設計只需改這支腳本重跑。Android 自適應圖示背景 #14663F。圖示網址不變：`https://learn.hglobal1985.com/icon-512.png`。
- **（2026-11-13 業主決定）全生態系統一固定配色**：行動大學不再有配色例外，`tokens.ts` 淺色改用與中央相同色值（深色本來就相同）；規範寫在 `docs/hglobal-color-standard.md` 與 `docs/hglobal-tokens.json`，已請中央採用為平台標準（所有現在與未來的 App 一致）。課程封面主題色與報名課程的底圖不受限（不屬於介面色）。
- **（2026-11-13 更正）**首頁標題旁恢復使用寰宇 logo（`assets/logo.png`）；學士帽圖示只用於 App 圖示（桌面、分頁、商店）。`make-icon.py` 不再覆蓋 `logo.png`。
- **首頁載入優化（2026-11-13）**：（1）公開路徑（公告、金句、設定、圖片）不再向會員中心查詢身分；（2）獎銜與 Amway 查詢從「每個請求」移到只在 `GET /me`，且 `/v1/me/amway` 共用一次查詢；（3）`GET /me` 內的多個中央查詢改為同時送出（原本一個接一個）；（4）首頁公告不等登入狀態載入完成就先抓。靜態檔本來就有 brotli 壓縮與永久快取（入口 JS 約 295KB），沒有改。若仍覺得慢，下一步可考慮：把中央查詢結果放 Cloudflare Cache（跨實例共用）、首頁骨架畫面、拆分入口 JS。
- **首頁骨架畫面**：課程資料回來之前，左右兩欄先顯示灰色骨架（緩慢明暗閃動），取代空白與轉圈（`src/ui/skeleton.tsx`）。
- **資料補填視窗改為直接填寫（2026-11-13）**：視窗內直接顯示並可儲存「真實姓名（報名課程對帳用）、培訓系統、地區教育中心、獎銜」，用會員本人的 Token 即時寫回中央，行動大學不保存、不寫日誌。API：`GET／PUT /api/v2/me/central-profile`（只允許 `legal_name`、`education_system`、`education_center`、`rank`；寫入走中央 `PUT /v1/me/profile/fields/legal_name`、`PUT /v1/me/amway/fields/{key}`）、`GET /api/v2/me/vocab?pool=education_system|education_center&q=`（轉接中央 `/v1/vocab/suggestions` 的關聯詞）。獎銜選項來自中央 field-definitions；需審核的欄位（寰宇＋中心）顯示「審核中」。**未勾選「我是 Amway 會員」的會員不代為勾選**（同意說明在會員中心），視窗提示到會員中心勾選。需要的中央 scope：`profile.basic.write`（真實姓名）、`amway.write`、`amway.read`——**與中央建議的最小 scope 不同，業主要求這個功能，所以收緊權限時須保留這兩個寫入 scope**。視窗仍然只在 Amway 核心欄位有空白時自動彈出。
- **資料補填視窗版面（2026-11-13）**：移除上方說明文字與各欄位提示；最上方置中並排兩顆同樣式按鈕「儲存」（一次儲存所有改過的欄位）與「暫時不要」；獎銜改為選擇後由「儲存」一起送出。
- **資料補填視窗（再更新）**：標題改為「完善資料審核開通權限」；移除右上角 X（「暫時不要」即關閉）。依中央最新規則（串接指令 2026-11-12.6，中央 PR #60）：勾選 Amway 會員後 **系統、中心、獎銜必填**；系統與中心可勾選「無」（值為字串 `無`，算已填、不是真實中心、不審核）；**獎銜需先有系統與中心**（未填時獎銜選單停用並提示）。欄位標籤用簡稱「系統」「中心」。獎銜選項、關聯詞、欄位值都是即時向中央讀取（獎銜選項快取 1 天），行動大學沒有自己的副本。
- **資料補填視窗**：標題改「先完善資料才能開通權限」；寬度縮小 15%（約螢幕 73%、最寬 442px）；「暫時不要」按鈕加 ✕ 圖示（讓看不懂中文的使用者也知道是關閉）。
- **資料補填視窗（版面）**：整個視窗壓縮在一個畫面內（無上下捲動）；按鈕與底部連結文字固定單行；系統、中心、獎銜各自右邊放與中央會員相同的「無」勾選框（只寫一個字「無」，與輸入框同一列）；獎銜下拉為浮動清單。關聯詞建議改成單行橫向滑動。
- **首頁頭像姓名可開啟資料視窗**：點首頁的頭像＋姓名＋獎銜，彈出「完善資料」視窗（可編輯、送出；視窗底部仍有前往會員中心的連結）。視窗新增 **Email** 欄位：已經有 Email 時只顯示（唯讀）；沒有 Email 才可輸入並寫回中央（`PUT /me/central-profile` key=`contact_email`；已有時伺服器回 409，要改請到會員中心）。
- 資料補填視窗的「暫時不要」按鈕文字改為「關閉」（仍帶 ✕ 圖示）。

## 2026-11-13：進入首頁太慢（6～9 秒）的原因與優化
- **原因（登入後的串列等待）**：①換發 Token（中央）→ ②`GET /me`（伺服器每次向中央問 4～6 件事，且分兩層）→ ③**共用登入檢查（又一次向中央）擋在前面**，做完才放行 → ④課程列表（`useApi` 等 `ready` 才發出，伺服器又重問一輪中央）→ ⑤資料補填視窗開啟後才再向伺服器要資料（又問中央兩三次）。每次向中央一趟約 0.2～1.3 秒，串起來 6～9 秒。
- **已改**：（1）共用登入檢查對「已登入」的人改在背景進行，不再擋住畫面；（2）`/v1/me/profile` 只問一次（名稱、頭像、信箱、真實姓名共用，並合併同時進來的相同查詢），且查不到不快取；（3）移除每個請求都多問一次的 `handoff`（管理員改由職務判斷）；（4）`GET /me` 的中央查詢（含 Amway）同一層同時送出；（5）資料不完整時，`/me` 直接帶回視窗內容 `member.profileForm`，視窗開啟不再多一趟網路；（6）回應加上 `Server-Timing: app;dur=…`，可在瀏覽器開發者工具 Network → Timing 看伺服器花了多久。
- **下一步（若仍慢）**：伺服器端把中央查詢結果放 Cloudflare Cache（跨機器共用，需評估隱私）；首頁課程與 `/me` 同時發出；單一 `/home` 彙整 API。
- **資料補填視窗（2026-11-13 再調整）**：標題改「資料需完整 才可瀏覽課程」且永遠顯示（不會因儲存後的訊息或內容變高被擠掉，`flexShrink: 0`）；欄位間距與高度縮小，讓視窗離螢幕邊緣更遠；真實姓名右邊並排新增「暱稱」（中央 `display_name`，`profile.basic.write`）；Email 恢復為可編輯（已有 Email 也可改，寫回中央 `contact_email`）。
- **資料補填視窗與鍵盤**：鍵盤打開時畫面可視高度會變矮，以前視窗高度跟著縮短、內容被擠壞。現在視窗固定原本大小（不設最大高度），外層放在可上下拉動的容器裡：可視高度夠就置中不用拉，被鍵盤擋住時整個視窗一起拉動。
- **資料補填視窗（儲存狀態與審核中）**：按「儲存」後按鈕顯示轉圈圈與「儲存中」；等待審核的欄位（中心、獎銜）儲存後**維持使用者填的內容**（顯示待審核的新值，不再變空白），標籤後加橘色粗體「（等待中心管理員審核）」。
- **資料補填視窗儲存變慢的優化**：原本每個欄位各送一次請求（逐一排隊），每次請求還先問中央名稱與職務，儲存完又再讀一次。現在：（1）所有改過的欄位**一次請求**送出（`PUT /me/central-profile` 的 `changes`），伺服器同時寫給中央，獎銜因為要先有系統與中心，最後才寫；（2）這個視窗的請求（儲存、載入、關聯詞）使用輕量身分（只驗 Token，不問中央名稱與職務）；（3）回應直接帶回最新欄位狀態，畫面不用再多問一趟；（4）儲存後重新整理其他資料改在背景。
- **獎銜下拉選單自動方向**：點開時量測螢幕剩餘空間，下方不夠（<220px）且上方較多就往上展開，高度隨剩餘空間調整（120～280px，可在清單內滑動），不再貼到螢幕底部。
- **資料補填視窗依中央最新規則（串接指令 2026-11-13.9，中央 PR #68～#79）重做**：（1）**系統**＝下拉選單（清單來自中央 `GET /v1/vocab/suggestions?pool=education_system&q=` 空字串＝整份，上限 100）＋「（未選擇）」「其他」（選其他出現「請輸入自訂內容」輸入框）；（2）**中心**＝所選（尚未儲存的）系統屬於 `GET /v1/me/amway` 的 `hglobal_systems`（沒選系統時看 `hglobal`）時，同樣是下拉選單＋其他；否則是一般輸入框；（3）系統、中心、獎銜右邊都有「無」勾選框（值 `無`；獎銜為 `none`）；獎銜需先有系統與中心；（4）**必填**：暱稱；勾選 Amway 會員後系統、中心、獎銜。標題旁有橘色「必填」小標籤；按儲存時有必填沒填，該列用 2px 橘框＋淡橘底標示且不送出；（5）**儲存鈕改金黃色**（`#f2dc27` 實心、`#e6c48c` 外框、深色字，中央視覺規範），關閉鈕維持綠色；（6）下拉選單是自訂元件（非原生），選項超過 12 個有搜尋框，依螢幕空間自動往上或往下展開。審核邏輯（獎銜與中心一起送審）由中央處理，行動大學照常先寫系統／中心再寫獎銜。
- **下拉選單疊層修正**：展開中的那一列蓋在所有列最上面（之前被上方的列蓋住、字重疊），一次只展開一個，展開清單加 2px 主色邊框與陰影，深色模式也看得清楚。
- 資料補填視窗：「真實姓名」欄位標題改為「本名(窗口對帳用途)」（欄位仍是中央的 `legal_name`）。
- 資料補填視窗標籤：欄位**填了就隱藏「必填」**；**中心、獎銜通過審核**（中央 status=approved、沒有待審新值、內容沒被改動）時標籤改為「審核通過」，外觀與「必填」相同（橘色小標籤）。
- 資料補填視窗標籤統一：中心、獎銜**等待審核**時標籤顯示「審核中...」（外觀同「必填」）；取消標題後面的「（等待中心管理員審核）」文字。標籤規則：沒填＝必填；等待審核＝審核中...；已通過＝審核通過；其餘不顯示。
- 資料補填視窗：**已通過審核的中心、獎銜被改動**時，標籤旁顯示純文字「變更需再重新審核」（無外框，顏色同標籤文字）；改回原值或儲存後就不再顯示。

## 2026-11-13（三）：中央新標準接入、各中心自行上架課程
- **中央新標準**：`POST /api/v2/central/webhook`（驗 `X-HG-Signature`、5 分鐘時間窗、依事件編號去重 `central_events`；`member.deleted` 刪除該會員在本 App 的所有資料、`member.profile_changed` 清快取）。Secret：`CENTRAL_WEBHOOK_SECRET`、`CENTRAL_SERVICE_SECRET`（業主已在 Cloudflare 設定；中央後台已設網址並測試 `delivered`）。
- **不再保存聯絡信箱**：寄 Email 時才用服務金鑰（`/v1/service/token`）呼叫 `contacts/lookup` 查信箱（用途：繳費相關通知 `payment_notice`、其餘 `course_notice`），用完即丟；migration `0018` 已清空既有副本。「通知設定」顯示的信箱即時向中央讀；只有模擬會員（測試）仍寫本地欄位。沒有 `CENTRAL_SERVICE_SECRET` 時不寄信（站內通知照常）。**真實寄信尚待業主用兩個帳號實測**。
- **版本回報**：超級管理員登入時（背景、每小時一次）呼叫 `handoff?integrated=2026-11-13.9&standards=webhook,delete_copy,no_email_copy,snapshot_reconcile`；`least_scope` 由業主在中央後台勾選，程式不宣稱。
- **各中心自行上架課程**：會長、音控（需有所屬中心）可在「設定 → 課程設定」新增並管理**主辦單位是自己中心**的課程（含章節、場次、附件、音檔、封面）。限制：主辦單位固定為自己的中心；指導單位不能是「寰宇總部」；審核群組只能用自己中心的；不能用 Mux 影片；已有人報名的課程／場次不能刪（只能下架），刪除限總部管理員。管理清單只列自己中心的課程。後端以 `requireCourseManager`（`api.ts`）統一把關；App 以 `canManageCourses`（`src/lib/roles.ts`）決定是否顯示入口。測試 `tests/center-courses.test.ts`（後端共 53 項）。
- 手機寬度（390px）已用瀏覽器實際看過課程設定清單、編輯頁；順手修正清單按鈕在窄螢幕被切掉。**尚未用真實會長帳號實測**。

## 2026-11-13（四）：全站單一播放器與迷你播放器
- **問題**：以前播放器綁在課程頁，離開頁面後聲音留在背景、回來又新建一個從頭播，造成「只聽到聲音」與「兩個聲音不同步」。
- **做法**（`apps/mobile/src/features/player/`）：全站只有一個播放核心 `engine`（網頁 `engine.web.ts`，手機 App `engine.ts` 用 expo-video），媒體元素只建立一次、不搬動不銷毀。課程頁用 `PlayerSlot`／`InlineAudio` 登記「我在這一頁」（用 `useFocusEffect`，因為 Stack 會把上一頁留在背景），離開頁面就切成迷你播放：
  - **純音檔**：底部分頁列正上方的細條（`MiniAudioBar`），時間軸可拖曳、播放／暫停、關閉；點標題區回課程頁。
  - **影片（Mux／示範）與 YouTube**：右下角浮動小視窗（`PlayerLayer`），可按住任意拖曳（位置記在瀏覽器），點一下回課程頁，有播放／暫停與關閉；YouTube 用 postMessage 控制。
  - 課程頁的影片改為**釘在上方**（不隨內容捲動），往下看附件與進度時也看得到畫面。
- **一次只播一個**：開另一堂時若正在播放，從畫面底部彈出面板（`switch-sheet.tsx`，網頁與 App 共用）顯示「正在播放／想播放」兩堂名稱，按鈕「關閉」「確定播放（秒數）」；**15 秒內沒操作視同同意改播**（`SWITCH_COUNTDOWN_SECONDS`）；詢問期間課程頁不顯示轉圈。選繼續原本的就回到原本那一堂。停止或播完後切換不詢問。登出自動關閉播放。
- **通知欄／鎖定畫面**：網頁用 Media Session（標題、封面、播放／暫停、前後 10 秒、拖曳進度）；手機 App 用 expo-video 的 `showNowPlayingNotification`、`staysActiveInBackground`，並在 `app.json` 開啟 `supportsBackgroundPlayback`、`supportsPictureInPicture`。
- **限制**：YouTube 在通知欄沒有連動（YouTube 自己的播放器不開放）；手機 App 內 YouTube 仍只在課程頁內嵌播放（WebView 無法跨頁保留）。**手機 App 的迷你播放與通知欄尚未用實機驗證**（要打包後測）；網頁版已用 390px 手機寬度的瀏覽器完整測過：播放→離開頁面仍播放且時間前進→浮動視窗拖曳→點一下回課程頁時間接續、永遠只有一個 `<video>`、切換詢問、音檔迷你列拖曳進度。
- **背景播放（切到別的 App／鎖螢幕）**：手機瀏覽器會暫停有畫面的 `<video>`，但不會暫停 `<audio>`。所以 `engine.web.ts` 在 `visibilitychange`／`pagehide` 時，把同一支影片的聲音交給隱藏的 `<audio>`（從同一秒接著播，HLS 另開一個 hls.js），回到瀏覽器再把影像接回去；`intent` 旗標區分「使用者自己暫停」與「瀏覽器因背景而自動暫停」，只有後者會被接手。純音檔本來就不會被暫停。（桌機瀏覽器模擬切換驗證過：背景時間持續前進、回前景影像接上；**Android／iPhone 實機尚未驗證**。）
- **通知欄圖片**：影片用課程 EDM（沒有就用封面、再沒有用 App 圖示）；純音檔優先用音檔內嵌的專輯封面（`audio-cover.ts`：MP3 的 ID3 APIC、M4A 的 covr，只用 Range 讀檔頭／moov），沒有內嵌就退回 EDM。手機 App（expo-video）目前只用 EDM／封面，音檔內嵌封面只有網頁版。
- **YouTube 精簡畫面**（業主選「方案 1＋字幕 A」）：iframe 網址帶 `controls=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0`，官方控制列與註解全關；載入後與開始播放時再用 postMessage 對 `captions`／`cc` 模組下 `unloadModule`（預設關閉字幕；若使用者的 YouTube 帳號強制開字幕，仍可能被蓋過）。課程頁內嵌時影片下方有自家控制列（`youtube-controls.tsx`：播放／暫停、可拖曳時間軸、時間、全螢幕〔iPhone Safari 不支援，自動隱藏〕）；浮動小視窗只留播放／暫停與關閉。YouTube 自己的標題列在暫停／剛載入時仍可能短暫出現（官方無法關閉）。已用假的 YouTube 頁驗證參數、指令、拖曳進度；**尚未用真的 YouTube 影片實測**。

## 2026-11-13（五）：活動日期下拉、完全公開、課程排序與下拉篩選、迷你播放器縮小
- **活動日期**：課程與每一則章節都有。輸入方式是年／月／日三個獨立下拉（`src/ui/date-select.tsx`，月份加英文縮寫如「11 月 Nov」，不用日曆）；新增課程、新增章節預設自動選當天，舊資料沒有日期時顯示「設定日期（預設今天）」按鈕（不會偷偷寫入）；課程另有「結束日期」（連續 2～3 天，預設與開始日同一天）。課程新增時，自動建立的「第 1 堂」沿用課程開始日。migration `0019`：`lessons.event_date`、`courses.is_public`。API：`eventDate`（章節 PATCH／新增）、`isPublic`（課程）。章節日期顯示在課程介紹頁、上課頁與進度清單。
- **完全公開**（課程編輯 →「誰可以瀏覽」）：未登入的訪客可看課程介紹、章節（沒綁場次的），並可播放；報名、進度、附件、留言仍要登入（訪客頁有「登入後報名」）。**只限免費、已上架的課程**（付費課程設公開、公開課程改付費，伺服器都會拒絕）。非公開課程對訪客仍導向登入。
- **全部課程**：預設依課程日期排序（今天之後的由近到遠 → 沒有日期的 → 已結束的由新到舊；沒有活動日期時用最近一場的開課日）；分類與單位篩選改成下拉選單（`src/ui/select.tsx`：網頁用瀏覽器原生選單，手機 App 用底部彈出清單）；課程卡片顯示活動日期。
- **迷你播放器縮小**：浮動小視窗右上角新增「─」縮小鈕（旁邊仍是 ✕ 關閉），縮小後變成 60px 小圓圖（課程 EDM，沒有就用 App 圖示；純音檔優先用內嵌專輯封面），播放中 360 度旋轉、暫停時停住並顯示 ▶；可拖曳，點一下恢復原本大小。純音檔的底部迷你列也有縮小鈕，縮小後同樣變小圓圖。換播另一堂時自動恢復。網頁版已用 390px 手機寬度驗證；**手機 App 版未用實機驗證**。

## 2026-11-13（六）：設定頁改版、學習成就、取消報名、費用尚未公布、橫幅改用 EDM
- **費用「尚未公布」**（migration `0020`：`courses.price_tba`）：課程編輯勾選後隱藏費用欄，卡片／介紹頁顯示「費用尚未公布」，伺服器拒絕報名（409 `price_tba`），也不能設完全公開。
- **活動日期**改顯示在標題右邊、靠右對齊，不再有「活動日期」四個字（課程卡片、課程介紹頁、上課頁標題、章節列）。
- **設定頁**：會員 ID 移到頁面最下方；「刪除學習資料」改「刪除帳號」（刪除本 App 所有資料含徽章並登出，接著開啟會員中心刪除會員帳號）；移除「通知設定」選單（入口改為站內通知頁右上角齒輪）；個人資訊卡下方新增「學習成就」。
- **學習成就（徽章）**：資料表 `achievements`／`member_achievements`，內建 6 枚（初次學習、學習新星、學習達人、完課成就、持之以恆、熱情參與）。條件類型：累計完成堂數、累計學完課程數、累計報名課程數、學習天數、留言次數、學完指定課程。進度即時從學習紀錄計算，達成時記錄取得時間並發站內通知「獲得學習徽章」（連結 `/achievements`）。會員頁 `/achievements`；超級管理員在「設定 → 管理 → 學習成就徽章設定」（`/admin/achievements`）新增／修改／停用／刪除。API：`GET /me/achievements`、`/admin/achievements`（限超級管理員）。
- **取消報名**：`POST /orders/:id/cancel`、`POST /courses/:id/cancel-registration`。審核中的報名、免費自動開通的報名可以反悔取消（刪除報名紀錄與開通，並清掉相關通知，稽核紀錄保留）；已繳費（含 VIP）開通的要聯絡窗口。入口：課程介紹頁、我的報名詳情。
- **站內通知設定**：Email 通知改用開關（iOS 風格 Switch）。**已報名 → 學習中**（底部分頁與頁面標題），頁面加「費用（免費／付費）」「主辦單位」兩個下拉，移除上方「學習中」子標題。
- **橫幅改由 EDM 自動產生**：移除課程封面上傳與底圖圖庫的全部程式（API `/admin/cover-backgrounds`、`/admin/courses/:id/cover`、`/media/img`、`cover-manager`、合成封面；`coverUrl` 欄位）。橫幅＝EDM 模糊放大當底圖＋EDM 清楚置中（`CourseCover`）。管理員只需上傳 EDM（`edm-manager.web.tsx`，可裁切）。資料庫舊欄位 `cover_key`、`cover_bg_id` 與 R2 內舊的 `cover/`、`bg/` 檔案保留未刪（刪課程時會順手清掉該課的舊封面檔）。
- **首頁**：EDM 輪播圓點放大並可點選（電腦版滑鼠可用）；改為一次最多翻一張（snapToInterval＋停用慣性＋scroll-snap-stop），輕滑不再連跳；訪客的推薦課程顯示「完全公開」的課程；備註改「顯示您可報名的課程」。
- 後端測試 58 項。手機寬度（390px）已看過：課程編輯（尚未公布勾選）、全部課程、課程介紹（EDM 橫幅）、設定、學習成就、徽章設定、通知設定開關、學習中頁；**手機 App（iOS／Android）未用實機驗證**。
- **課程卡片左上角斜緞帶**（業主選方案 1）：尚未開始的課程顯示橘色「剩餘 X 天」（以今天對照活動日期，沒有活動日期用最近一場開課日；今天或已開始、已結束、沒有日期都不顯示）；未登入的訪客看到「完全公開」課程時，改顯示綠色「免費公開」（優先於倒數）。元件 `src/ui/corner-ribbon.tsx`，判斷在 `course-card.tsx`／`features/courses/sort.ts`。

## 2026-11-13（七）：播放控制列統一、課程介紹頁改版、底部確認面板、迷你播放器升級
- **播放控制列統一**：Mux 影片、YouTube、純音檔三種模式的時間軸一律在影片外面下方，共用同一個元件 `PlayerControls`（`features/player/player-controls.tsx`；時間軸是 `seek-bar.tsx`）。瀏覽器內建控制列已關閉（只有全螢幕時才用內建的）。以後改設計只改這兩個檔案。手機 App 的 `VideoView` 也改為 `nativeControls={false}`，全螢幕鈕走 `VideoView.enterFullscreen()`（未實機驗證）。
- **YouTube 預估分鐘數**：YouTube 沒有長度時，網頁版管理員開啟「章節與影片」頁會自動用看不見的播放器偵測長度並寫回（`admin/youtube-duration.web.ts`），課程卡片與章節就會顯示「約 N 分鐘」；長度為 0 時不再顯示「0 分鐘」。
- **橫幅 EDM 模糊功能徹底移除**；改為「EDM 預設位置」＋「16:9 裁切封面」（migration `0021`：`courses.edm_view_y`；`cover_key` 改存裁切封面）。管理員在課程編輯 → 課程海報：① 拖曳金色取景框決定課程介紹頁一進來停在 EDM 哪裡（`edmViewY`，原圖高度比例）；② 裁切固定 16:9 的封面，當課程清單縮圖（`PUT/DELETE /admin/courses/:id/cover`，API 摘要有 `coverUrl`、`edmViewY`）。可不換圖只調整（「調整預設位置與封面」）。
- **課程介紹頁**：上方 `EdmStage`（`features/courses/edm-viewer.tsx`）＝EDM 寬度符合畫面、只能上下拖曳（滑鼠／手指／滾輪，左右忽略）、預設停在 `edmViewY`、點一下彈出站內小視窗（放大縮小、下載、分享；分享一律叫出系統分享選單，圖示用系統預設的 `ShareIcon`）。外框 `StageFrame`（`ui/stage-frame.tsx`）與上課頁影片區共用，**高度永遠一致**。EDM 下方所有課程說明文字（標題、單位、獎銜、講師、堂數、分鐘、日期、介紹…）已移除，只留報名按鈕、場次、章節、留言。審核中顯示同一列「付款審核中（點擊查看）」＋「取消」；已報名／已開通不顯示「開始上課」，也不顯示「取消報名」。完全公開（免費）的課程沒有報名按鈕，且**會員也不必報名就能看**（`canWatch`／章節不上鎖）。
- **底部確認面板**：新增 `BottomSheet` 外框（`ui/bottom-sheet.tsx`）與 `confirmSheet()`／`confirmAsk()`（`features/confirm.tsx`，`ConfirmSheetHost` 掛在根版面）；改播詢問面板、取消報名、刪除帳號／課程／章節／徽章／留言、移除 EDM 全部改用它，不再用瀏覽器／系統對話框。
- **迷你播放器**：右上角 ✕ 在上、縮小在下（直向排列）；小圓圖加大到 84px（點一下恢復成小視窗，不會暫停）；小視窗與圓圖外框改成網站色系（深綠、橄欖、金）的反光漸層外框（網頁版漸層流動；手機 App 用金色框＋綠色光暈近似）。
- **永久規則**已寫入 `CLAUDE.md`「介面規則」：分享圖示與系統分享選單、底部確認面板、PlayerControls 共用、StageFrame 共用、課程介紹頁規則。

## 2026-11-13（八）：圖片分享、章節上鎖遮罩、本名＋暱稱、影片放大、獎銜不符緞帶
- **EDM 放大小視窗**（`edm-viewer.tsx`）：沒有標題，視窗大小剛好貼合圖片、沒有多餘留白；放大／縮小／下載／分享按鈕疊在圖片上。**分享直接傳送圖片檔**（`shareImage`：網頁用 Web Share 的檔案分享，瀏覽器不支援檔案就分享連結、電腦沒有分享選單就複製連結；手機 App 先下載到暫存再用 `expo-sharing` 叫出系統分享選單）。新增套件 `expo-sharing`（SDK 58 版）。
- **章節上鎖遮罩**（業主選方案 2）：課程介紹頁在尚未報名／不符資格／費用尚未公布，且所有章節都不能看時，章節卡片疊半透明灰色遮罩＋大鎖頭＋「報名後才能觀看」（獎銜不符顯示「獎銜不符，目前無法報名」、費用未公布顯示「費用尚未公布，暫不開放」），章節完全不能點。
- **審核員看到「本名（暱稱）」同時顯示**：共用函式 `applicantLabel`（`contract.ts`），用在報名審核卡片與「有新的報名待審核」通知（付費報名才有本名快照；兩者相同或缺一時只顯示一個）。
- **Mux／示範影片可放大縮小**（`zoom-math.ts`）：雙指（手機）或滾輪（電腦）放大縮小，**縮小不低於 100%**，放大後按住拖曳查看其他區域；換堂或離開課程頁自動還原。網頁版在 `player-layer.web.tsx`（pointer events＋滾輪）；手機 App 在 `player-slot.tsx`（PanResponder，未實機驗證）。YouTube 不支援（iframe 無法）。
- **課程卡片緞帶**：登入會員、獎銜不符且尚未報名的課程，右上角另外顯示紅色「獎銜不符」（左上角仍是倒數或免費公開，兩條並存）。`CornerRibbon` 新增 `side`、`danger`。

## 2026-11-13（九）：YouTube 放大、刪帳號清通知、禁止整頁縮放、迷你播放器防誤觸
- **YouTube 也能放大縮小**：與 Mux 同一套手勢（滾輪／雙指，不低於 100%，放大後拖曳）；縮放的是整個影片區（含 iframe），手勢層蓋在上面（YouTube 自己的點擊暫停被擋住，改用外面的 `PlayerControls`）。手機 App 內 YouTube 是 WebView（不經全站播放器），尚無放大。
- **會員刪除帳號後的孤兒通知**：`purgeMember` 在刪報名紀錄前，先刪連到這些報名的通知（`/admin/orders/:id`、`/orders/:id`）。migration `0022` 一次清掉所有「連到已不存在報名紀錄」的通知。
- **禁止整頁雙指縮放**（`lib/no-page-zoom.ts`，根版面啟用）：viewport 鎖 1 倍＋`touch-action: pan-x pan-y`＋擋 iOS Safari gesture 事件與觸控板 Ctrl＋滾輪；影片區與圖片小視窗自己的手勢不受影響。App 本來就不會整頁縮放。
- **迷你播放器防誤觸**：縮小／放大後 0.5 秒內忽略「點擊」（`engine.recentlySwitched()`），避免手指放開的點擊落在換出來的新按鈕（播放／暫停、關閉）上造成暫停。

## 2026-11-13（十）：課程排序與條件、統計分析、緞帶改版、分享鈕、影片提示
- **課程排序與條件**（超級管理員，設定 → 管理，`/admin/list-rules`，migration `0023`：`ui_settings` 一筆 JSON）：①「全部課程」排序優先順位（上下移動；預設：審核中 > 符合資格未報名〔未開課 > 已開課〕> 公開免費 > 已報名 > 不符資格〔未開課 > 已開課〕，組內未開課依日期由近到遠、已開課由新到舊）；②每種狀態緞帶的**文字、顏色（只能選規範色 10 色，色碼在 `features/courses/ribbons.ts`）、是否顯示**。狀態：左上＝免費公開、學習中、已聽完、報名審核中、可以報名、獎銜不符、費用尚未公布、報名已截止；右上＝倒數（文字 `{n}` 換成天數）、進行中、已結束。API：公開 `GET /ui-config`、`PUT /admin/ui-config`（限超級管理員，顏色與分組由伺服器驗證、缺的自動補齊）。App 用 `UiConfigProvider`（`state/ui-config.tsx`）取得，抓不到用內建預設。預設色：學習中＝主綠、可以報名＝黃、獎銜不符＝紅、報名審核中＝橘、已聽完＝橄欖綠、倒數＝鮭粉、免費公開＝成功綠。
- **統計分析**（`/admin/stats`，`GET /admin/stats/mux`）：超級管理員、總部秘書一定可看，超級管理員可在該頁勾選其他職務（會長、音控、課務、審核員）。內容依常用程度排序：最常用＝本月免費額度用量（Video API delivery-usage，免費額度以 100,000 分鐘／月估算，實際以 Mux 方案為準）、近 30 天觀看概況、熱門影片；其他＝影片庫存、各影片本月傳輸量、播放品質；進階（預設收合）＝作業系統／瀏覽器／國家分布、播放錯誤、直播串流。每區獨立讀取，讀不到只在該區顯示原因（Data API 需要有「Mux Data 讀取」權限的 Access Token）。**用模擬的 Mux 回應測過；尚未用真實 Mux 帳號驗證回傳格式。**
- **課程介紹頁**：報名鈕改「按此報名＋繳費審核」；「付款審核中」直接進該筆報名的完整明細（`/orders/:id`，有留言功能；API 新增 `pendingOrderId`）；章節遮罩在獎銜不符時加一行「限XX獎銜以上報名」；課程內容還沒上傳（`Lesson.ready=false`）章節區顯示「敬請期待」且仍套用遮罩；上方工具列（回上一頁那一列）靠右新增分享鈕（課程頁、章節播放頁各自分享自己的網址；`HeaderShare`，Mac 與 iOS 同圖示，電腦瀏覽器沒有分享選單時複製連結並浮出「已複製連結」`ToastHost`）。
- **影片操作提示**：進入影片、觸摸影片、拖曳時間軸時顯示「ico＋可拖曳或放大縮小 點兩下復原」（與 EDM 提示同樣式，3.5 秒自動消失）；影片任意處點兩下還原 100%。
- **迷你播放器**：外框加粗 1.5 倍（4.5px）；暫停播放時外框反光動畫一起暫停。
- **登入後預設進首頁**；**「登出所有 App」改呼叫中央 `POST /v1/auth/logout-all`**（結束所有 App、所有裝置與會員中心網站的登入；過期會先換發 token 再登出），再導向瀏覽器共用登入登出。
- 全部課程卡片：章節 0 堂不顯示堂數。
- **YouTube 影片中央的播放／暫停大按鈕**：YouTube 沒有任何參數可以關閉，只能用遮蓋的方式；尚未處理，等業主決定。

## 2026-11-13（十一）
- 影片／YouTube：點一下畫面恢復播放／暫停（延遲 300ms 判斷，點兩下仍是還原大小）。
- 課程頁／上課頁上方工具列高度 44（僅網頁生效），分享按鈕旁加「分享」文字；報名按鈕改「按此報名＋審核繳費」。
- 首頁推薦輪播改自訂分頁滑動（一次最多一張）、圓點距離縮小；會員的推薦不含公開免費課程；新增課程欄位「不顯示首頁推薦」（migration 0024 `courses.hide_home`）。
- 所有緞帶更貼角落（框 96px、帶寬變薄、字縮小）。
- 「學習中」第一張卡「回到剛才的學習」（以 AsyncStorage 記在本機，key `last-lesson:<sub>`）。
- 尚未驗證：標題列高度與輪播手勢未在實機／含後端的瀏覽器實測（只通過型別檢查與後端測試）。
- 課程新增「地點」與「無」勾選（migration 0025 `location`、`location_none`）；全部課程卡與首頁輪播顯示「地點：…」，勾「無」則不顯示。
- 緞帶尺寸／位置已復原成 2026-11-13（十）的設定（業主說上一版調整不是他要的意思；「更往上靠近＋50%」的真正意思待釐清，勿再自行縮小）。
- 緞帶：大小不變，band top 24→12（離上邊框縮短 50%，業主選項 2）。
- Mux delivery-usage：結束時間須在 12 小時前（HTTP 400 invalid timeframe），已改為現在−13 小時。
- 緞帶再次復原為 bafea86 版本（top 24、框 128）。業主兩次否決調整方案，除非業主提供圖示，勿再改緞帶。
- Mux delivery-usage 時間須為整點，已取整。
- 緞帶（業主說明：更靠近角落、三角形範圍小、減少遮擋 EDM）：框 104、band left -50/top 12、字 13px、padding 5；5 字標籤剛好容納。
- 統計「各影片本月傳輸量」改顯示影片名稱（meta.title／passthrough），404＝已刪除的影片。
- 緞帶：band 中心對齊角落對角線（文字置中）；框 90、left/right -60、top 15、字 11px。
- 統計分析頁拆成兩個互不混合、預設收起的來源區塊：① Mux（/admin/stats/mux）② App 資料庫 D1（/admin/stats/app，app-stats.ts）。Cloudflare 流量統計尚未串接（Worker 沒有 Cloudflare API 權杖）。
- 統計分析加第三個來源「Cloudflare 網站流量」（/admin/stats/cloudflare，cf-stats.ts）：需 Secret CF_API_TOKEN（Account Analytics:Read）；CF_ACCOUNT_ID 在 wrangler.jsonc vars。未設定時顯示「尚未設定」。
- Cloudflare 區塊擴充：帳戶層（Workers、R2、Web Analytics RUM）與網域層（httpRequestsAdaptiveGroups：國家、裝置、瀏覽器、OS、路徑、狀態碼、機房…），各合併成一次 GraphQL（避免被限流）。網域層需權杖加「區域→Analytics→讀取」，CF_ZONE_ID 在 wrangler.jsonc。停留時間 Cloudflare 沒有，不做。
- 排序分組新增 eligible_tba「符合資格、尚未報名・費用尚未公布」（第 3 組，舊設定自動插在 eligible_upcoming 後面）。
- EDM 放大檢視：自製拖曳（上下左右）、按鈕不透明度 0.85 且放大到 56px、按著圖片時按鈕暫時隱藏；課程頁 EDM 下方提示按著時也隱藏。未在實機驗證。
- EDM 放大檢視：移除 ＋／－／百分比；改兩指捏合縮放（以中心為基準，兩指移動也可平移）與滑鼠滾輪；其餘按鈕縮為 44px。
- 工具列「分享」字體 17（與標題同大）。
- EDM 放大檢視：按鈕 88px 實心黑（不透明）、距邊 16px、下方新增常駐提示「十字 icon＋可拖曳移動、兩指放大縮小」（按著圖片時一起隱藏）。
- 業主決定（2026-11-14）：YouTube 影片縮放／覆蓋層功能**先保留**，上架時若被退件再改（風險：YouTube API 政策禁止修改播放器／蓋在播放器上，見對話記錄）。舊 Mux 金鑰 HGlobal Learn Video Read 已撤銷。
- EDM 放大檢視按鈕改 64px（業主指定）。
- EDM 放大檢視：按鈕 50px；提示文字與下載／分享同一排（左提示、右按鈕），太擠自動換行。
- **移除「場次」功能**（業主 2026-11-14）：刪除場次編輯器（runs-editor）、場次 API（/admin/courses/:id/runs、/admin/runs/*）、報名選場次、章節綁場次、「報名已截止」緞帶、「分場次報名」標籤、nextRunAt／hasRuns／registrationOpen 欄位；報名與開通改為只以課程為單位。正式站 course_runs 沒有任何資料。資料庫的 course_runs 資料表與 lessons／order_items／enrollments 的 run_id 欄位**刻意保留不刪**（D1 難以改 PK／外鍵，刪表會讓 lessons.run_id 的外鍵出錯；欄位預設空字串，程式已完全不用）。
- 編輯課程：「費用尚未公布」勾選與費用輸入框同一列（勾選時輸入框變灰不可輸入）。
- 沒有 EDM／封面的課程：CourseCover 由程式依「課程名稱＋分類」自動排版（主題色底、分類標籤、大標題，字級依長度自動縮放 fitFontSize，非 AI）；用於課程介紹頁上方、課程卡、首頁輪播、編輯課程預覽。
- 自動標題封面：分類標籤與標題置中（避免被左上角緞帶遮住）。
- 日期顯示一律不補 0（format.ts：dateTime／dateOnly／plainDate／eventDays；分隔符統一為 /；分鐘保留兩位數）。輸入欄位（toLocal）與 CSV 維持原格式。
- 課程新增「鑽石免費」（migration 0026 diamond_free）：鑽石（含）以上獎銜報名費用為 0（自動開通），其他獎銜原價；編輯頁勾選位於費用輸入框右側、在「尚未公布」下方。欄位 diamondFree／diamondFreeNow。
- 早鳥優惠（migration 0027 early_bird／early_price_twd／early_until）：勾選後設早鳥價與截止日（台灣時間含當天）；有效期間 priceTwd＝早鳥價；欄位 earlyBird{priceTwd,until,active}；免費／鑽石免費優先於早鳥。
- 系列合併（migration 0028 courses.series）：課程編輯頁「系列」欄位＋已有系列選項＋「複製這門課，建立下一梯」（POST /admin/courses/:id/duplicate：草稿、標題加（複製）、帶費用／資格／章節架構，不帶日期／EDM／附件／音檔；原課程無系列時兩邊都設成課程名稱）。全部課程清單與首頁推薦：同系列只顯示一張代表卡（審核中＞已開通＞日期最近未開始＞最近結束），卡片「還有 N 個梯次」點開底部面板列全部梯次。各梯次的報名、繳費、審核仍各自獨立。
- 編輯課程：分類欄位下方新增「已有的分類」可直接點選（GET /admin/categories）。
- 編輯課程：移除「副標題」「講師／主辦」欄位，課程卡也不再顯示副標題（資料庫欄位保留、API 仍相容舊資料）。
- 超級管理員「關鍵字管理」頁（/admin/keywords，設定頁入口）：集中新增／改名（同步更新用到的課程）／刪除（清空課程欄位）分類、系列、場地；migration 0029 keywords 存預先建立的；課程編輯頁的「已有的分類／系列／場地」選項含預先建立的。
- 編輯課程頁：「系列」（含已有系列選項、複製下一梯按鈕）移到最上方封面預覽（EDM 位置）下方、獨立一張卡。
- 分類可複選：courses.category 存「、」分隔文字；編輯頁已有分類可複選；課程封面顯示多個分類標籤；清單分類篩選比對任一；關鍵字管理的改名／刪除逐課處理（rewriteCategories）。
- 主辦單位可複選（總部管理員）：host_unit 存「、」分隔；host_center_key 取勾選的第一個非總部中心（權限／審核以它為準）；清單單位篩選逐一比對。
- 管理員課程清單（/admin/courses）改用與「全部課程」相同的呈現（同排序、同分類／單位篩選、同 CourseCard），每張卡下方加管理按鈕（獎銜、上下架、編輯、章節與影片）；不合併同系列（才選得到每一梯）。CourseCard 新增 footer／onPress。
- 設定頁「管理」區：課程設定移到第一個。
- 管理員課程清單：同系列合併，點「還有 N 個梯次」選擇要管理哪一梯（選了之後該卡換成那一梯，帶出它的管理按鈕）。SeriesSheet 新增 onPick／currentId。
- 梯次面板排序：未結束的日期最近在上、最晚在下，已結束的接在後面（最近結束在前），沒日期最後（series-sheet byNearest）。
- 課程卡／自動封面／首頁輪播的標題顯示：有系列顯示系列名稱，沒有系列才顯示課程名稱（displayName）；課程頁標題列與管理清單的『課程名稱』仍是真正的課名。
- 課程卡／首頁輪播：不再顯示系列名稱與課程標題文字；單位改為單一標籤「寰宇總部指導、台中主辦」（unitLine），單位名稱結尾的教育中心數字代碼不顯示（cleanUnit，含篩選選單）。
- 下拉選單統一：移除 select.web.tsx（瀏覽器原生 <select>），所有 Select（篩選、日期、表單）改用底部彈出面板（BottomSheet），目前項目打勾並自動捲到該項。
- **中心清單與中央不一致（2026-11-14 修復）**：原因是 `/centers` 把中央清單與本地 `orders.center_label`、`review_group_members.center_label` 聯集（當初為了保險），本地舊資料裡出現「新竹」「民權」（沒有代碼的舊寫法）就被當成新中心。已改為只用中央清單；儲存主辦單位、審核群組負責／成員中心時驗證必須在中央清單內；`centerList` 失敗不快取並沿用最近一次成功清單。規則寫入 CLAUDE.md「資料正本規則」。正式站 `orders` 內的歷史快照「新竹」「民權」保留（報名當下的中心名稱快照），只是不再出現在選單。
- 正式站 orders 歷史快照中心名稱已改成中央正式名稱：新竹→新竹 122（3 筆）、民權→民權 018（2 筆；center_key 同步），2026-11-14 業主指示。
- **全部課程改版（2026-11-14）**：改為 2 欄（寬畫面 3 欄）小卡片 `SeriesTile`，只有 EDM＋「選擇梯次」下拉（底部面板列所有梯次，點進該梯課程頁）；有系列＝系列專屬 EDM（沒上傳就用系列名稱當大標題），沒系列＝課程自己的 EDM（沒有就課程名稱）；緞帶保留，文字以日期最近的梯次為準（`nearestOf`／`groupBySeries`）。課程詳細頁 EDM 也加緞帶。新增系列專屬 EDM：series_art（migration 0030）、PUT/DELETE `/admin/series/edm?series=`（僅超級管理員）、「關鍵字管理」頁系列列上傳（網頁版）。
- 全部課程與管理員課程清單的單位篩選改為只比對「主辦單位」（不含指導單位），標題「主辦單位」。
- 全部課程／學習中／站內通知／設定：移除大標題（Screen 無 title 時仍保留右側按鈕與副標）；課程卡刪除「N 堂・約 N 分鐘」統計文字；課程卡與系列小卡封面一律 16:9。
- 系列專屬 EDM 上傳：選圖後開裁切面板（鎖 16:9、拖曳／縮放、預覽），只上傳裁好的橫式圖，不保留原圖（series-edm.web.tsx）。
- 緞帶倒數文字預設改「倒數 {n} 天」（舊預設自動轉換）。上方標題列高度＝底部主選單（barHeight 56），兩者都有陰影（標題列陰影用 HeaderShadow 疊在下緣；iOS 原生標題列高度由系統決定，無法強制）。
- 全部課程：刪除主辦單位篩選，原位置換成齒輪（課程管理權限者才顯示）→ /admin/courses。
- 改播詢問面板：只留「是否更換播放？」＋倒數條＋按鈕；左「關閉」依文字寬度、右「確定播放（N）」填滿，文字不換行。
- 上課頁：刪除「完成，下一堂」按鈕與「附件教材」標題；播放到結尾自動記錄完成（不自動跳下一堂）；附件改成圖示＋下方標題，靠右、與章節標題同一列。
- 修正：上課頁白屏（新增的自動完成 Hook 放在提前 return 之後，資料載入完成時 React 報錯）。Hook 一律放在所有提前 return 之前。
