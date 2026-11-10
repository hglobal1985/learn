# 寰宇行動大學（learn）2026-11-10.2 差異交接

僅依 2026-11-10 18:30 的中央會員串接指令補上相較 2026-11-10.1 的差異。中央會員 repo、資料庫與設定未變動。

## 本 PR 新增

- Central 認證：`apps/api/src/auth/jwt.ts`、`apps/launch/auth/backend.mjs` 嚴格驗 RS256、JWKS、typ=at+jwt、iss、aud、app_id=learn、exp，再讀 token 的 sub；不信任任何 client 端提供的會員身分。
- Rank：`apps/api/src/access/eligibility.ts`、`apps/launch/auth/backend.mjs` 呼叫中央資格查詢 API，逾時、Token 無效、未審核或非 200 一律拒絕；不保存 Amway 個資或資格結果。
- Expo：`apps/mobile/src/lib/central-auth.ts` 以 nonce SHA-256、state、Google 登入中繼、`learn://auth/google` 完成登入，網頁版回傳 `/auth/done`；Access 記憶體、Web Refresh SessionStorage、Native Refresh SecureStore，換發加鎖。
- Web：`apps/launch/auth/web-client.mjs` 新增登入中繼、清除 fragment、會員設定頁、管理員 handoff 版本回報；Live Worker 新增需驗 JWT 的影片清單、影片詳情與播放授權。
- Mux：Signed 影片仍只在後端檢查資格後簽署播放 JWT；正式 Worker 未設定 MUX_SIGNING_KEY_ID / MUX_SIGNING_PRIVATE_KEY 時維持 503，不洩漏 Signed Playback ID。
- App 狀態：啟動及回到前景查中央 config，處理 active / paused / killed / min_version，不可用時保持公開內容但拒絕需登入的操作。
- OpenAPI：`packages/shared/src/central-api.generated.ts` 是從中央會員 `openapi/hglobal-id.v1.json` 真正產生的 TypeScript 型別，不是手寫。
- App 顯示：加入 H-Global1985 登入、隱私權政策、完整隱私說明、帳號刪除入口。
- 契約版本常數：2026-11-10.2。

## 未動、仍照既有方式運作

- D1 影片、分類、留言及影片進度資料表未重新建置。
- 已匯入的 Mux Signed 草稿仍為草稿，未公開。
- 已存在的 `HGLOBAL_ID_CLIENT_SECRET` 不讀取、不刪除；依業主指令需另行核准移除。
- 不進行原生 Google SDK 或舊 OIDC 登入。
- 未修改中央會員 `hglobal1985/id`、DNS、既有金鑰或任何正式會員資料。

## 上線限制

- 正式環境部署、商店發版需業主核准。
- 正式中央會員 `/v1/apps/learn/config` 必須已部署且回傳 active，Google 登入中繼才可端到端驗收。
- 原生手機 App 需實際 iOS／Android 裝置驗證深層連結與安全儲存；原生應用尚未上架。
- Mux Signed 播放需要既有 Mux Signing Key 安全配置到 learn Worker；不要在對話中提供私鑰。
- 共用 SSO 自動同步、完整管理後台、跨頁 History API 導航仍要各自整合及驗收，這次沒有聲稱完成。
