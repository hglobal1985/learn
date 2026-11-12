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
