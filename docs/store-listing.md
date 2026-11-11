# 寰宇行動大學：上架資料（App Store／Google Play）

最後更新：2026-11-11。這份文件是送審時要填的內容草稿與檢查清單，送審前請業主確認文字。

## 基本資料

| 項目 | 內容 |
| --- | --- |
| App 名稱 | 寰宇行動大學（業主已確認） |
| 副標題（Apple，30 字內） | 隨時隨地，持續成長 |
| 套件識別碼 | iOS `com.hglobal1985.learn`／Android `com.hglobal1985.learn` |
| 類別 | 教育（Education） |
| 版本 | 0.2.0（iOS buildNumber 1、Android versionCode 1；之後由 EAS 自動遞增） |
| 隱私權政策網址 | https://learn.hglobal1985.com/privacy |
| 客服網址 | https://learn.hglobal1985.com/support |
| 客服信箱 | service@hglobal1985.com |
| 刪除帳號網址（Google Play 必填） | https://learn.hglobal1985.com/support#delete |
| 年齡分級 | 4+／適合所有人（無使用者產生內容、無廣告、無賭博） |
| 價格 | 免費；**App 內沒有任何購買**（付費課程只在網站辦理，App 內不顯示價格與購買入口） |

## 商店說明文字

**簡短說明（Google Play，80 字內）**
用手機隨時上課：找課程、領取課程、記錄學習進度，開課與審核結果即時通知。

**完整說明**
寰宇行動大學是會員專屬的線上學習 App。
・找課程：依主題分類瀏覽，查看每門課的章節與時長。
・領取課程：免費課程一鍵領取，立即開始學習。
・我的課程：學習中與已完成的課程一目了然，自動記錄每一堂的進度。
・站內通知：課程開通、訂單審核結果即時通知。
・會員登入：以 Google 帳號登入會員中心，課程資格依會員資料自動判斷。

**關鍵字（Apple，100 字元內）**
線上課程,學習,課程,教育,自我成長,溝通,領導,會員

## 截圖需求

- iPhone 6.9 吋（1320×2868）至少 3 張；iPad 13 吋（2064×2752）至少 3 張（因為 `supportsTablet: true`；若不想做 iPad 截圖，可把它改成 false）。
- Android 手機至少 2 張（1080×1920 以上），以及 1024×500 主題圖片。
- 建議畫面：首頁、課程列表、課程介紹、上課播放、我的課程、通知。截圖前先把示範課程換成正式課程，並關掉「內部測試」標示（見下方）。

## Apple「App 隱私權」問卷建議答案

| 資料類型 | 是否收集 | 用途 | 是否與身分連結 | 是否用於追蹤 |
| --- | --- | --- | --- | --- |
| 聯絡資訊 → 姓名（顯示名稱） | 是 | App 功能（訂單核對） | 是 | 否 |
| 識別碼 → 使用者 ID（會員識別碼） | 是 | App 功能 | 是 | 否 |
| 使用資料 → 產品互動（課程進度） | 是 | App 功能 | 是 | 否 |
| 購買記錄 | 否（App 內不販售） | — | — | — |
| 位置、聯絡人、相片、健康、財務 | 否 | — | — | — |

Google Play「資料安全性」：同上；資料傳輸皆加密；可要求刪除（App 內「刪除學習資料」與會員中心刪除帳號）。

## 送審備註（Review Notes）草稿

> 本 App 為會員學習平台。登入使用 Google 帳號（會員中心登入中繼）。
> 審查用帳號：請業主準備一個 Google 測試帳號（不要用私人帳號），並在會員中心把它設成可看到所有課程的狀態；把帳號密碼填在 App Store Connect／Play Console 的審查資訊欄，**不要寫在這個 repo 裡**。
> App 內不提供任何購買；付費課程只在網站辦理，App 只讓已開通的學員觀看（符合 App Store 審查指南 3.1.3(a)／3.1.1 的相關規定，App 內沒有任何外部付款連結）。
> 帳號刪除：App 內「我的」→「會員中心」可刪除會員帳號；「我的」→「刪除學習資料」可立即刪除本 App 的資料。

## Google Play：個人帳號的封閉測試（必做，至少 14 天）

1. Play Console 建立應用程式 → 測試 → 封閉測試 → 建立測試群組，加入至少 **12 位**測試者的 Gmail。
2. 用 EAS 產生 Android 正式版（AAB）：`npx eas build -p android --profile production`，上傳到封閉測試軌道。
3. 請 12 位測試者用連結加入測試並安裝，**連續 14 天**保持加入狀態（中途退出要重新計算）。
4. 14 天後在 Play Console 申請正式版存取權，再送正式審查。
5. 內部快速測試（不計入 14 天）可用 `npx eas build -p android --profile preview` 產生 APK 直接安裝。

## iOS：TestFlight

1. App Store Connect 建立 App（Bundle ID `com.hglobal1985.learn`）。
2. `npx eas build -p ios --profile production` → `npx eas submit -p ios` 上傳 TestFlight。
3. 內部測試者可直接測試；外部測試需先通過 Beta 審查。

> EAS 指令需要業主的 Expo 帳號登入（`npx eas login`）；這些步驟必須在業主的電腦或有 Expo 帳號的環境執行。

## 上架前必須完成的設定

- [ ] **關閉模擬登入**：`apps/launch/wrangler.jsonc` 的 `vars.DEMO_LOGIN` 改成 `"off"` 後重新部署（關閉後「測試身分」與任何人都能當管理員的入口就會消失）。
- [ ] 首頁「內部測試版」標示移除（`apps/mobile/app/(tabs)/index.tsx` 的 `SandboxBanner`）。
- [ ] 示範課程換成正式課程，各堂設定 YouTube 或 Mux 影片（管理員：「我的」→「課程設定」→「各堂影片」）。
- [x] Mux 簽名金鑰已由業主在 Cloudflare 設定（`MUX_SIGNING_KEY_ID` 一般變數、`MUX_SIGNING_PRIVATE_KEY` Secret），後端已確認能簽出播放網址。
- [ ] 用一支真實的 Mux 影片（Signed Playback ID）在 App 與網站各播放一次。
- [ ] App Store 上架取得 App ID 後，把 `apps/mobile/src/features/app-gate.tsx` 的 iOS 更新網址改成商店網址。
- [ ] 實機測試：iPhone 與 Android 各測一次 Google 登入、領課、播放（示範影片／YouTube／Mux）、通知、刪除資料。

## 待業主決定

- 是否支援 iPad（影響截圖數量）。
- 付費課程的付款方式說明文字（目前寫「依客服提供的方式付款」）。
