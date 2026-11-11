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
1. 在 `apps/mobile` 建立導覽（底部分頁：首頁、課程、我的課程、通知、我的）與設計系統。
2. 畫面：課程列表／詳情、領課／結帳、訂單、通知、學習播放（先用示範播放器）、我的學習、管理員訂單審核與課程獎銜設定、模擬登入。
3. 付費流程以平台判斷：Web 顯示，iOS/Android 隱藏。
4. 後端：重新設計資料表，新增課程、章節、獎銜、訂單、通知 API。
5. 之後：中央會員、Mux 簽名播放、YouTube、帳號刪除入口、上架資料。
6. 部署驗證：實際用瀏覽器與裝置測試後，才宣稱完成。

## 注意
- 未驗證不可宣稱完成；模擬資料要明確標示。
- 不要在對話或程式碼中放任何金鑰。
