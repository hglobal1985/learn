# 行動大學手機管理影片（Mux / YouTube）

正式網址：https://learn.hglobal1985.com

## 超級管理員使用步驟
1. 使用 H-Global1985 登入。
2. 手機底部固定選單 →「我的學習／帳號」→「影片管理」。只有中央會員驗證的超級管理員才會看到管理入口。
3. 選擇「Mux 已上傳影片」或「YouTube 連結」，填寫標題、介紹、分類和觀看權限。
4. Mux：由已連線的 Mux 媒體庫選取，或從 Mux 控制台貼入 Asset ID。這只匯入現有資料，**不重新上傳影片**。
5. YouTube：貼入官方 HTTPS 影片網址。限定影片使用不公開模式，須明確確認來源連結仍可能被轉傳。
6. 儲存草稿。管理清單可按「發布影片」或「下架」。

## 權限與安全
- Worker 驗證 learn Access Token 並向中央會員核對超級管理員權限；不能只靠前端隱藏按鈕或電子郵件。
- 中央會員故障、App 暫停、Token 無效、沒有權限時，新增／發布都預設拒絕。
- Mux 影片先存草稿；發布前驗證資產 ready、播放政策安全，以及 Signed Playback 金鑰已配置。
- 不變更原本 Mux 資產、中央會員資料庫或既有 Signed 影片草稿。
- 舊 HGLOBAL_ID_CLIENT_SECRET 不讀取也不刪除。

## Cloudflare 需要設定的 Mux Secrets（不可以貼到聊天／GitHub）
Cloudflare → Workers → learn → Settings → Variables and Secrets，使用 Secret 類型：
- MUX_TOKEN_ID（Mux API token ID）
- MUX_TOKEN_SECRET（Mux API token secret）
- MUX_SIGNING_KEY_ID（Mux signing key ID）
- MUX_SIGNING_PRIVATE_KEY（Mux signing PEM 私鑰）

前兩項讓管理員直接瀏覽已上傳的 Mux 媒體庫、檢查資產；後兩項用來安全播放 Signed 影片。若尚未設定，可輸入 Asset ID 建立草稿，但不能發布 Mux 影片。

Cloudflare 正式部署及機密設定變動須由業主另行核准；本 PR 未部署正式環境。iOS／Android 商店上架也尚未執行。
