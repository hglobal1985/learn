# V2 驗收紀錄（2026-11-11）

## 已部署
- 獨立測試：https://learn-v2-preview.hglobal1985-static.workers.dev/
- 原正式站：https://learn.hglobal1985.com/（未切換）
- PR：https://github.com/hglobal1985/learn/pull/10（草稿，未合併）
- 版本：91bd5722f230ef1f0cd3c8e56e4d7f7265a166cb
- V2 CI：https://github.com/hglobal1985/learn/actions/runs/42978608950 （成功）
- 原 CI：https://github.com/hglobal1985/learn/actions/runs/42978608908 （成功）

## 實際瀏覽器測試通過
- 390px 手機漢堡選單開關、會員選單、搜尋彈窗、關鍵字結果。
- 訪客點免費領取 → 測試登入 → 返回原課程 → 購物車 → 確認免費領取 → 完成頁 → 我的課程。
- 已領取課程顯示開始學習，避免重複領取。
- 示範影片可播放（12 秒、readyState 4、無媒體錯誤），筆記可儲存，標記完成與下一堂切換有效。
- 付費測試課程送出 → 待人工審核 → 切換測試管理員 → 收到通知 → 由通知進入訂單 → 確認審核 → 切回學員收到開通通知 → 我的課程出現付費課程。
- 管理員新增「鑽石」限定測試課程；白金測試學員點領取得到資格不足提示。
- 首頁與播放器在 375、390、430、768、1440px 檢查文件寬度，未水平溢出。課程詳情 390px 未溢出。
- 獨立 Cloudflare 測試站重新跑通免費訂單完成流程。

## 自動檢查
- V2：TypeScript、Vite build、4 項訂單規則測試。
- 原專案：shared 10、API 28、preview 9、launch 38，共 85 項測試。
- 全專案 lint、mobile typecheck、mobile web export。
- 已修復瀏覽器測試發現的結帳導頁競態：清空購物車後不得覆蓋訂單完成路由。

## 隔離與成本
測試站為 Cloudflare Workers Static Assets，沒有 Worker 運算程式、D1、R2、中央會員或其他服務綁定；只使用現有帳號的靜態資產服務，未升級方案或建立付費訂閱。
官方說明靜態資產儲存及請求免費：https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
所有訂單、權限與通知是同一瀏覽器的隔離資料，不能作為正式服務或跨裝置同步。

## 尚未驗收／尚未實作的正式整合
- 依業主最新指示，中央會員暫不串接；此階段沒有正式登入、中央獎銜與正式超級管理員驗收。
- 正式訂單／審核／站內通知的 Worker + D1 API 尚未新增或接入。
- 正式 Mux Signed 與 YouTube 播放保留舊站，V2 只有介面與示範影片，不能聲稱正式播放已接入。
- Shifu 新訂單完成頁仍未實際送單（必填電話及條款）；現有三門體驗課未開課，未能進入真正播放器。
- Shifu 登出與重新登入尚未測試，保留原登入工作階段。
- 未完整逐頁完成 Shifu 視覺一對一對照、真實 iOS Safari／Android 裝置測試，尤其 Safari 靜態影片 Range 行為需後續確認。
- 正式會員修改、正式課程素材、評價送出、場次報名、真實媒體指派仍需後續確認及實作。

## 回復與切換
未修改舊版 Worker 或正式網域，正式站不需要回復。測試站若需回復，重新部署指定 Git commit 的 apps/web-v2/dist 靜態產物即可。完整正式整合與驗收前不得合併作為主站切換或覆蓋 learn Worker。
