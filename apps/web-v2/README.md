# 寰宇行動大學 V2（隔離測試前端）
React + TypeScript + Vite，手機優先，獨立路由；不修改 launch Worker、中央會員、D1 或正式影片權限。

```sh
cd apps/web-v2
npm ci --workspaces=false
npm run dev --workspaces=false
npm run test --workspaces=false
npm run build --workspaces=false
```

## 測試流程
1. 首頁 → 免費課程 → 免費領取 → 測試登入（返回原課程）→ 購物車 → 結帳 → 確認免費領取 → 我的課程 → 播放器。
2. 付費課程送單 → 切換測試管理員 → 站內通知／後台訂單 → 確認付款審核 → 切回測試學員 → 通知 → 已開通課程。
3. 新增／編輯課程 → 指定最低獎銜 → 用低於該獎銜的測試會員嘗試領取（拒絕）。

使用 localStorage `hglobal:web-v2:sandbox:v1`，資料限同一瀏覽器。測試管理員是 UI 驗收角色，不是正式認證。不得用此儲存機制作正式訂單、跨使用者通知或影片授權。
混合訂單將免費／付費分開，免費立即開通。重複領取、待審訂單重複送出、下架、資格不符及重複審核會拒絕。

## 播放
`public/orientation.mp4` 為本專案使用 FFmpeg color/drawbox/ fade 產生的 12 秒幾何動畫，沒有第三方素材或音軌。各章節共用示範影片，UI 明確標示不是正式課程。
正式 Mux Signed 與 YouTube 仍保留在既有服務；`LearningGateway` 定義未來媒體授權介面，沒有前端簽章或中央會員網路請求。

## 正式串接（依業主指示暫停）
- 中央會員登入與資格判斷須依現有 2026-11-10.2 契約，後端驗證，不信任此處測試 rank。
- 訂單、審核、權限、通知須落實於 Worker/D1，需伺服器原子性、冪等、身分隔離及稽核。
- Signed Playback 只透過既有已驗證後端核發。未串接時不輸出任何正式影片 ID 或 token。
- Profile 正式修改應使用中央會員既有流程，不自行重建。

## 發布限制
建置輸出 dist，可部署至獨立測試主機。需要 SPA fallback。不得將這個測試版直接覆蓋正式 learn.hglobal1985.com。
舊版 Worker 沒有修改，現有正式部署保持不動；未通過正式整合與完整驗收前不切換主站。
