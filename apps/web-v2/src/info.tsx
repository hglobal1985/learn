import { Link, useParams } from "react-router-dom";
import { useStore } from "./store";
import { CourseCard, Page } from "./components";
export function Teachers() {
  const { state } = useStore();
  const { id } = useParams();
  const teachers = Array.from(
    new Set(state.courses.map((c) => c.teacher)),
  ).filter((t) => !id || t === id);
  return (
    <Page title={id || "講師陣容"} subtitle="用經驗陪伴學習，讓方法走進生活。">
      <div className="teacher-grid">
        {teachers.map((t) => (
          <article className="panel teacher-profile" key={t}>
            <div className="avatar">H</div>
            <p className="eyebrow">H-GLOBAL FACULTY</p>
            <h2>{t}</h2>
            <p>
              寰宇原創示範教學團隊。正式講師介紹、照片與資歷將在內容確認後更新。
            </p>
            {!id && (
              <Link
                className="secondary"
                to={`/teachers/${encodeURIComponent(t)}`}
              >
                查看講師與課程 →
              </Link>
            )}
          </article>
        ))}
      </div>
      {id && (
        <>
          <h2>講師課程</h2>
          <div className="course-grid">
            {state.courses
              .filter((c) => c.teacher === id && c.published)
              .map((c) => (
                <CourseCard course={c} key={c.id} />
              ))}
          </div>
        </>
      )}
    </Page>
  );
}
export function Articles() {
  const { id } = useParams();
  return (
    <Page
      title={id ? "每天十分鐘，讓學習真正發生" : "學習專欄"}
      subtitle="關於成長、練習，與那些值得慢慢累積的事。"
    >
      {id ? (
        <article className="prose">
          <p className="eyebrow">學習方法 · 寰宇編輯室</p>
          <h2>先留下一段時間，再找到一個方向</h2>
          <p>
            不必等到完全有空才開始學習。選擇每天最容易保留的十分鐘，把它放進你原本的生活節奏，例如早餐後、通勤結束，或晚餐前。
          </p>
          <h2>一次只帶走一個行動</h2>
          <p>
            看完一堂課後，寫下一件今天就能試做的事。把「我懂了」變成「我試過了」，觀念才會逐漸成為自己的方法。
          </p>
          <h2>每週回頭看看</h2>
          <p>
            翻開學習筆記，找出這週做得最順利的一次。你不需要每天都完美，只要願意再開始，就仍然走在前進的路上。
          </p>
          <Link className="primary" to="/courses?free=1">
            找一堂免費課程
          </Link>
        </article>
      ) : (
        <Link className="journal-card" to="/articles/learning">
          <span className="journal-art">
            每天
            <br />
            一點。
          </span>
          <div>
            <p className="eyebrow">學習方法</p>
            <h2>每天十分鐘，讓學習真正發生</h2>
            <p>從一個小習慣，累積長期的改變。</p>
            <span>閱讀文章 →</span>
          </div>
        </Link>
      )}
    </Page>
  );
}
export function Help() {
  return (
    <Page title="常見問題" subtitle="讓你安心開始，也順利繼續。">
      <div className="prose">
        {[
          [
            "如何領取免費課程？",
            "進入課程介紹，選擇免費領取，使用測試會員登入後確認訂單。0 元課程不需審核，會立即加入我的課程。",
          ],
          [
            "付費課程如何開通？",
            "不串接線上金流。測試訂單送出後會通知管理員，管理員確認付款並審核後，課程才會開通。本環境不進行真實收款。",
          ],
          [
            "為什麼無法領取某些課程？",
            "課程可設定最低獎銜。正式資格未串接中央會員前，使用測試會員的獎銜示範；資格不符時無法下單。",
          ],
          [
            "可以用中央會員登入嗎？",
            "目前依開發要求暫不串接。正式階段將沿用 H-Global1985 中央會員，不另建帳號系統。",
          ],
          [
            "為什麼影片是示範內容？",
            "V2 正在進行介面與流程驗收，正式 Mux Signed 和 YouTube 播放尚未接入。受限影片不會因此變成公開。",
          ],
          [
            "通知在哪裡？",
            "主選單與學員中心都有站內通知入口，可查看領課成功與審核結果，並標為已讀。",
          ],
          [
            "如何保存學習筆記？",
            "在播放器切換到我的筆記，輸入內容後按儲存。測試資料只保存在此瀏覽器，清除瀏覽器資料後會消失。",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </Page>
  );
}
export function Policy({ privacy = false }: { privacy?: boolean }) {
  return (
    <Page title={privacy ? "體驗環境隱私權說明" : "體驗環境使用說明"}>
      <article className="prose">
        <p>本版本為寰宇行動大學 V2 隔離測試環境，僅供介面與流程驗收。</p>
        <h2>測試資料</h2>
        <p>
          測試身分、訂單、通知、收藏、進度與筆記保存在目前瀏覽器，不會送至中央會員或正式訂單資料庫。請勿輸入真實姓名、電話、付款資料或敏感資訊。
        </p>
        <h2>課程與付款</h2>
        <p>
          課程內容及價格皆為示範。任何操作不產生正式購買紀錄、不收取款項，也不提供正式課程授權。
        </p>
        <h2>正式服務</h2>
        <p>
          正式會員登入、權限、課程內容及服務條款需在後續整合驗收完成後發布；此頁不代表正式營運條款。
        </p>
      </article>
    </Page>
  );
}
