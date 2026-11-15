import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Search,
  ShoppingBag,
  UserRound,
  Menu,
  X,
  Bell,
  ArrowUpRight,
  ArrowRight,
  Clock,
  Heart,
  ChevronRight,
  GraduationCap,
  BookOpen,
  LogOut,
} from "lucide-react";
import { useStore } from "./store";
import { owned, type Course } from "./domain";
export const memberLinks = [
  ["/account", "學習中心"],
  ["/my-courses", "我的課程"],
  ["/favorites", "我的收藏"],
  ["/orders", "訂單紀錄"],
  ["/notifications", "站內通知"],
  ["/settings", "會員資料"],
] as const;
export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="寰宇行動大學首頁">
      <span className="brand-mark">
        H<span>✦</span>
      </span>
      <span>
        寰宇行動大學<small>H-GLOBAL1985 · LEARN</small>
      </span>
    </Link>
  );
}
export function Layout() {
  const { state, update } = useStore();
  const [panel, setPanel] = useState<"menu" | "member" | "search" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const unread = state.notices.filter(
    (n) => !n.read && n.recipient === state.member?.id,
  ).length;
  useEffect(() => {
    setPanel(null);
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key, location.hash]);
  useEffect(() => {
    if (panel) {
      dialog.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.current?.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [panel]);
  return (
    <>
      <div className="sandbox">V2 體驗環境 · 測試資料，不產生正式訂單</div>
      <header className="header">
        <Brand />
        <nav className="desktop-nav">
          <NavLink to="/courses">探索課程</NavLink>
          <NavLink to="/teachers">講師陣容</NavLink>
          <NavLink to="/my-courses">我的課程</NavLink>
        </nav>
        <div className="header-tools">
          <button aria-label="搜尋課程" onClick={() => setPanel("search")}>
            <Search />
          </button>
          <Link aria-label={`購物車，${state.cart.length} 門課程`} to="/cart">
            <ShoppingBag />
            {state.cart.length > 0 && <i>{state.cart.length}</i>}
          </Link>
          <button aria-label="會員選單" onClick={() => setPanel("member")}>
            <UserRound />
            {unread > 0 && <i>{unread}</i>}
          </button>
          <button aria-label="開啟主選單" onClick={() => setPanel("menu")}>
            <Menu />
          </button>
        </div>
      </header>
      <dialog
        aria-label={
          panel === "search"
            ? "搜尋課程"
            : panel === "member"
              ? "學員選單"
              : "探索寰宇"
        }
        ref={dialog}
        onCancel={() => setPanel(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setPanel(null);
        }}
        className={`drawer ${panel === "search" ? "search-dialog" : ""}`}
      >
        <div className="drawer-head">
          <strong>
            {panel === "search"
              ? "尋找你的下一堂課"
              : panel === "member"
                ? "學員選單"
                : "探索寰宇"}
          </strong>
          <button aria-label="關閉選單" onClick={() => setPanel(null)}>
            <X />
          </button>
        </div>
        {panel === "search" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              navigate(`/courses?q=${encodeURIComponent(String(q))}`);
            }}
          >
            <label>
              課程、講師或關鍵字
              <input name="q" placeholder="想學習什麼？" autoFocus required />
            </label>
            <button className="primary">
              搜尋 <Search size={18} />
            </button>
          </form>
        ) : (
          <>
            {panel === "member" && (
              <div className="member-mini">
                <UserRound />
                <h3>{state.member?.name || "歡迎來到寰宇"}</h3>
                <p>
                  {state.member
                    ? `測試會員 · ${state.member.rank}`
                    : "登入後，收藏你的學習旅程"}
                </p>
              </div>
            )}
            <nav className="drawer-nav">
              {(panel === "member"
                ? memberLinks
                : [
                    ["/courses", "探索課程"],
                    ["/teachers", "講師陣容"],
                    ["/articles", "學習專欄"],
                    ["/help", "常見問題"],
                    ["/my-courses", "我的課程"],
                    ["/notifications", "站內通知"],
                  ]
              ).map(([url, label]) => (
                <Link to={url} key={url}>
                  {label}
                  <ChevronRight size={18} />
                </Link>
              ))}
              {panel === "menu" && (
                <details>
                  <summary>課程分類</summary>
                  {["自我成長", "溝通表達", "團隊領導", "健康生活"].map((c) => (
                    <Link key={c} to={`/courses?category=${c}`}>
                      {c}
                    </Link>
                  ))}
                </details>
              )}
              {state.member?.role === "admin" && (
                <Link to="/admin">
                  超級管理員後台
                  <ChevronRight size={18} />
                </Link>
              )}
            </nav>
            {state.member ? (
              <button
                className="secondary full"
                onClick={() => {
                  update((s) => ({ ...s, member: null, cart: [] }));
                  setPanel(null);
                  navigate("/");
                }}
              >
                <LogOut size={16} />
                登出測試會員
              </button>
            ) : (
              <Link
                className="primary full"
                to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}
              >
                登入學員中心
              </Link>
            )}
          </>
        )}
      </dialog>
      <main id="main">
        <Outlet />
      </main>
      <footer>
        <div>
          <Brand />
          <p>
            讓學習，成為前進的力量。
            <br />
            隨時隨地，與寰宇一起成長。
          </p>
        </div>
        <div className="footer-links">
          <div>
            <h3>探索</h3>
            <Link to="/courses">所有課程</Link>
            <Link to="/teachers">講師陣容</Link>
            <Link to="/articles">學習專欄</Link>
          </div>
          <div>
            <h3>學習支援</h3>
            <Link to="/help">常見問題</Link>
            <Link to="/account">學員中心</Link>
            <Link to="/notifications">站內通知</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 寰宇行動大學 H-GLOBAL1985</span>
          <Link to="/privacy">隱私權說明</Link>
          <Link to="/terms">體驗環境使用說明</Link>
        </div>
      </footer>
    </>
  );
}
export function Artwork({
  course,
  hero = false,
}: {
  course: Course;
  hero?: boolean;
}) {
  return (
    <div
      className={`art ${course.theme} ${hero ? "hero-art" : ""}`}
      role="img"
      aria-label={`${course.title} 原創課程插畫`}
    >
      <span className="art-caption">H-GLOBAL LEARNING SERIES</span>
      <div className="art-orbit" />
      <div className="art-block b1" />
      <div className="art-block b2" />
      <div className="art-block b3" />
      <span className="art-star">✳</span>
      <div className="art-label">
        {course.category}
        <span>
          {hero ? "START YOUR NEXT CHAPTER" : "GROW AT YOUR OWN PACE"}
        </span>
      </div>
    </div>
  );
}
export function CourseCard({ course }: { course: Course }) {
  const { state, update } = useStore();
  const liked = state.favorites.includes(course.id);
  return (
    <article className="course-card">
      <Link to={`/courses/${course.id}`}>
        <Artwork course={course} />
      </Link>
      <button
        className={`favorite ${liked ? "liked" : ""}`}
        aria-label={`${liked ? "取消收藏" : "收藏"}${course.title}`}
        onClick={() =>
          update((s) => ({
            ...s,
            favorites: liked
              ? s.favorites.filter((id) => id !== course.id)
              : [...s.favorites, course.id],
          }))
        }
      >
        <Heart size={18} fill={liked ? "currentColor" : "none"} />
      </button>
      <div className="card-body">
        <span className="eyebrow">
          {course.category}
          {course.rank !== "不限獎銜" && ` · ${course.rank}以上`}
        </span>
        <Link to={`/courses/${course.id}`}>
          <h3>{course.title}</h3>
        </Link>
        <p>{course.teacher}</p>
        <div className="card-bottom">
          <strong>
            {owned(state, course.id)
              ? "已加入學習"
              : course.price === 0
                ? "免費課程"
                : `NT$ ${course.price.toLocaleString()}`}
          </strong>
          <span>
            <Clock size={13} />{" "}
            {course.lessons.reduce((n, l) => n + l.minutes, 0)} 分鐘
          </span>
        </div>
      </div>
    </article>
  );
}
export function SectionTitle({
  title,
  sub,
  to,
}: {
  title: string;
  sub?: string;
  to?: string;
}) {
  return (
    <div className="section-title">
      <div>
        {sub && <p className="eyebrow">{sub}</p>}
        <h2>{title}</h2>
      </div>
      {to && (
        <Link to={to}>
          查看全部 <ArrowUpRight size={18} />
        </Link>
      )}
    </div>
  );
}
export function Empty({
  title,
  body,
  to = "/courses",
  action = "探索課程",
}: {
  title: string;
  body: string;
  to?: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <BookOpen size={36} />
      <h2>{title}</h2>
      <p>{body}</p>
      <Link className="primary" to={to}>
        {action}
        <ArrowRight size={17} />
      </Link>
    </div>
  );
}
export function Page({
  title,
  children,
  subtitle,
}: {
  title: string;
  children?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="container page">
      <p className="eyebrow">H-GLOBAL1985 · LEARN</p>
      <h1>{title}</h1>
      {subtitle && <p className="lead">{subtitle}</p>}
      {children}
    </div>
  );
}
export function MemberShell({ children }: { children: ReactNode }) {
  const { state } = useStore();
  return (
    <div className="container page">
      <div className="member-hero">
        <div className="avatar">
          <GraduationCap />
        </div>
        <div>
          <h1>{state.member?.name}</h1>
          <p>
            測試學員 · {state.member?.rank}{" "}
            <span className="tag">學習旅程持續中</span>
          </p>
        </div>
      </div>
      <nav className="tabs member-tabs">
        {memberLinks.map(([url, label]) => (
          <NavLink end to={url} key={url}>
            {label}
            {url === "/notifications" && <Bell size={14} />}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
