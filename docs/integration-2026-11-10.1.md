# 寰宇行動大學：中央會員串接過渡版 2026-11-10.1

本文件僅記錄相對於既有程式的差異。正式新版串接指令到達後先對比差異，**禁止重寫已正常運作的功能**。

- 名稱：寰宇行動大學。App ID：`learn`。Bundle / Package：`com.hglobal1985.learn`。
- 網頁：`https://learn.hglobal1985.com`。中央會員：`https://id.hglobal1985.com`。
- Web / iOS / Android 將共用 App ID；尚未收到新版登入協議，**現在不啟用登入**。
- 舊 Worker Secret `HGLOBAL_ID_CLIENT_SECRET` 暫時保留、**禁止使用**；不要把金鑰或 Token 放進前端、公開 GitHub 或日誌。
- 身分驗證邊界：`apps/api/src/auth/session.ts`、`apps/launch/auth/session.mjs`。
- 資格查詢邊界：`apps/api/src/access/eligibility.ts`、`apps/launch/access/policy.mjs`。網頁公開版只開放 published + public。
- 影片資料新增 `audience` 欄位（`hglobal_verified` / `everyone`），原有 `min_rank_code` 保留。對未收到中央確認的限定影片一律拒絕。
- 獎銜階梯由中央會員提供；不要寫死 33 級選項或保存會員的 Amway 資料。
- 未來登入接線時只替換 auth/access 層，禁止從舊版 OIDC 指令自行接 Google 登入。

部署前須確認完整 CI、正式 D1 migration、Worker Secret 未遭覆蓋。官方登入尚未開放前，不要把樣板或本機模擬模式當正式服務。
