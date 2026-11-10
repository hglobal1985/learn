/** Mobile-first admin content. All actions are server-verified; this page contains no video secrets. */
export const ADMIN_PAGE=`
<main class="wrap main">
 <div class="section-head"><div><h1 class="title">影片管理</h1>
 <p class="muted">超級管理員可使用手機匯入 Mux 已上傳影片，或貼上 YouTube 連結。新增影片先儲存為草稿。</p></div>
 <a href="/settings" class="pill">我的學習與帳號</a></div>
 <p class="notice" id="admin-status" role="status">正在確認管理員身分…</p>
 <section id="admin-panel" hidden>
  <div class="details">
   <h2>新增影片</h2>
   <form id="new-video" class="admin-form">
    <label class="field-label">影片來源
     <select name="source_type" id="source-type" required>
      <option value="mux">Mux｜已上傳的影片</option>
      <option value="youtube">YouTube｜影片連結</option>
     </select>
    </label>
    <div id="mux-source" class="source-box">
     <label class="field-label">選擇 Mux 已上傳影片
      <select id="mux-library"><option value="">正在讀取 Mux 清單…</option></select>
     </label>
     <label class="field-label">或貼上 Mux Asset ID
      <input name="asset_id" id="mux-asset-id" placeholder="在 Mux 影片資訊頁複製 Asset ID" autocomplete="off">
     </label>
     <p id="mux-status" class="muted">只會匯入現有影片，不會重新上傳原始檔案。</p>
    </div>
    <div id="youtube-source" class="source-box" hidden>
     <label class="field-label">YouTube 影片網址
      <input name="youtube_url" type="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="url">
     </label>
     <label class="field-label">YouTube 可見度
      <select name="youtube_visibility" id="youtube-visibility">
       <option value="public">公開影片</option>
       <option value="unlisted">不公開影片（連結仍可被分享）</option>
      </select>
     </label>
    </div>
    <label class="field-label">影片標題
     <input name="title" maxlength="120" required placeholder="例如：營養課程 第 1 堂">
    </label>
    <label class="field-label">影片介紹
     <textarea name="description" maxlength="3000" rows="3" placeholder="簡短介紹這部影片"></textarea>
    </label>
    <label class="field-label">影片分類
     <input name="category" maxlength="60" value="培訓">
    </label>
    <label class="field-label">觀看權限
     <select id="access-mode" name="access_mode">
      <option value="rank">通過資格審核的會員</option>
      <option value="members">所有登入會員</option>
      <option value="public">公開影片（所有人）</option>
     </select>
    </label>
    <div id="rank-fields">
     <label class="field-label">最低獎銜（由中央會員提供）
      <select name="min_rank_code" id="min-rank"><option value="">無最低獎銜要求</option></select>
     </label>
     <p class="muted">只有經 H-Global1985 核准的獎銜才具備資格。</p>
    </div>
    <label class="check-row" id="youtube-risk" hidden><input name="accept_unlisted_risk" type="checkbox">
     <span>我知道 YouTube 不公開連結仍能被轉傳，並非真正的私人影片。</span>
    </label>
    <button class="btn admin-submit" id="save-video" type="submit">儲存影片草稿</button>
   </form>
   <p class="notice" id="save-result" role="status" hidden></p>
  </div>
  <section class="details">
   <div class="section-head"><h2>我的影片清單</h2><button type="button" class="pill" id="reload-videos">重新整理</button></div>
   <p class="muted">草稿不會顯示在公開課程。發布限定影片前必須通過完整安全檢查。</p>
   <div id="admin-videos" class="video-list" aria-live="polite">載入中…</div>
  </section>
 </section>
</main>
`;
