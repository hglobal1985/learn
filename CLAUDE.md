# 寰宇行動大學（learn）開發守則

業主是程式小白：回覆一律使用台灣繁體中文、白話說明。接手前先讀 `docs/v2-handoff.md`。

## 用語（業主永久指示）
- **一律用「報名課程」，不要用「購買課程」或「購買」**。對應用語：報名清單（不是購物車）、報名紀錄／報名編號（不是訂單）、繳費（不是付款）、報名審核（不是訂單審核）、免費報名（不是領取）。
- 免費課程：報名當下自動通過，不需審核。付費課程：報名後由窗口在站內審核繳費後才開通。

## 業主已決定
- App 名稱「寰宇行動大學」維持；只有會員中心本身的畫面不顯示「寰宇」，其他 App 可以顯示。
- 暫時保留：訂單（報名紀錄）存下單時的顯示名稱、保留深色模式。
- 不要碰中央會員系統（`hglobal1985/id`、`id.hglobal1985.com`、D1 `hglobal-id*`）。
- 不在對話、程式或 repo 放任何金鑰；機密由業主在 Cloudflare 後台設定。

## 開發
- 後端：`apps/launch`（Cloudflare Worker `learn` + D1 `learn-v2`），測試 `npm test -w @learn/launch`。
- App：`apps/mobile`（Expo），型別檢查 `npm run typecheck -w @learn/mobile`。
- 部署：見 `docs/v2-handoff.md`「部署指令」。業主在 Cloudflare 後台改變數後，記得確認程式沒有被退回舊版。
