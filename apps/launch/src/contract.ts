/**
 * API 契約（/api/v2）。App 端以 `import type` 取用，兩邊共用同一份型別。
 * 這個檔案只能放型別與常數，不能引用 Worker 專用的東西。
 */
export type Role = "student" | "admin";
export type ClientPlatform = "web" | "ios" | "android";

export type Rank = { code: string; name: string; order: number };

export type Member = {
  sub: string;
  name: string;
  /** 只有模擬會員有示範獎銜；中央會員的獎銜屬 Amway 資料，App 不取得（null）。 */
  rank: Rank | null;
  role: Role;
  demo: boolean;
  /** 會員中心的頭像網址（公開；沒有頭像或模擬會員為 null）。 */
  avatarUrl?: string | null;
  /** 對外獎銜（取自會員中心；獎銜為「無」顯示「安麗寶寶」）。只放記憶體，不存資料庫。 */
  rankLabel?: string | null;
  /** 會員中心資料還有哪些空白（例如「Email」「Amway 會員資料」）；空陣列表示完整。 */
  profileMissing?: string[];
  /** 資料不完整時一併帶回的「完善資料」視窗內容（即時取自會員中心，不保存）。 */
  profileForm?: ProfileForm;
  /** 職務名稱（中央職務＋本 App 的窗口身分），顯示用。 */
  titles: string[];
  /** 是否有任何報名審核權限。 */
  reviewer: boolean;
  /** 已核准的中心名稱（沒有則 null）。 */
  center: string | null;
};

export type EnrollmentState = "opened" | "pending" | null;

export type CourseSummary = {
  id: string;
  title: string;
  subtitle: string;
  teacher: string;
  category: string;
  /** iOS/Android 請求時一律為 null（商店規範：App 內不顯示價格）。 */
  priceTwd: number | null;
  free: boolean;
  minRank: Rank;
  theme: string;
  status: "draft" | "published" | "archived";
  lessonCount: number;
  totalMinutes: number;
  eligible: boolean;
  /** 會長不受獎銜限制也可報名。 */
  allowPresident: boolean;
  /** 指導單位、主辦單位（空字串表示未設定）。 */
  guidanceUnit: string;
  hostUnit: string;
  /** 最近一場的開課時間（沒有場次為 null）。 */
  nextRunAt: string | null;
  /** 活動日期（YYYY-MM-DD）；eventEnd 只有連續 2～3 天的活動才有。 */
  eventStart: string | null;
  eventEnd: string | null;
  /** 完全公開：未登入的訪客也能瀏覽介紹與章節、觀看（只限免費課程）。 */
  isPublic: boolean;
  /** 費用尚未公布：顯示「費用尚未公布」、暫不開放報名。 */
  priceTba: boolean;
  /** 目前是否在限時免費期間；originalPriceTwd 為原價（App 為 null）。 */
  freeNow: boolean;
  originalPriceTwd: number | null;
  freeUntil: string | null;
  /** 有場次的系列課程：需選場次報名。 */
  hasRuns: boolean;
  enrollment: EnrollmentState;
  completedLessons: number;
  /** 課程海報 EDM（直式）的公開網址；沒有上傳時為 null。 */
  edmUrl: string | null;
  /** 從 EDM 裁切出來的 16:9 橫式封面（課程清單縮圖）；沒有時畫面改用色塊。 */
  coverUrl: string | null;
  /** EDM 預設停留位置（原圖高度的比例 0～1）。 */
  edmViewY: number;
};

export type MediaType = "demo" | "youtube" | "mux" | "audio";
export type Lesson = {
  id: string;
  position: number;
  title: string;
  minutes: number;
  completed: boolean;
  kind: "video" | "audio";
  /** 這一堂的活動日期（YYYY-MM-DD；沒有設定為 null）。 */
  eventDate: string | null;
  /** 時間軸分段（秒）：同一支影片切成多堂時使用；null 表示從頭／播到結束。 */
  start: number | null;
  end: number | null;
  /** 屬於某一場次（null＝整個系列共用）；locked＝尚未報名該場。 */
  runId: string | null;
  locked: boolean;
  /** 只有管理員會拿到（編輯影片來源用）。 */
  media?: { type: MediaType; ref: string | null };
};
export type CourseRun = {
  id: string;
  title: string;
  startsAt: string | null;
  location: string;
  registerUntil: string | null;
  capacity: number | null;
  remaining: number | null;
  priceTwd: number | null;
  free: boolean;
  status: "open" | "closed";
  open: boolean;
  enrollment: EnrollmentState;
};
export type CourseDetail = CourseSummary & {
  description: string;
  lessons: Lesson[];
  runs: CourseRun[];
  /** 只有管理員會拿到。 */
  admin?: { hostCenterKey: string | null; freeFrom: string | null; freeUntil: string | null; reviewGroupId: string | null; basePriceTwd: number };
};

export type OrderStatus = "pending" | "opened" | "rejected";
export type ReviewAction = "paid" | "vip" | "reject" | "defer" | "revoke";
export const REVIEW_REASONS = {
  unpaid: "款項未入帳",
  wrong_amount: "款項金額不正確",
  rank: "獎銜不符合",
  unknown_member: "查無此人，請到會員中心補填個人資料",
  other: "其他原因",
} as const;
export type ReviewReason = keyof typeof REVIEW_REASONS;
export type OrderEvent = {
  id: string;
  action: "submit" | ReviewAction | "message" | "note";
  actorName: string;
  actorTitle: string;
  mine: boolean;
  reason: string | null;
  message: string;
  /** 私人備註：只有審核人員會拿到。 */
  note?: string;
  createdAt: string;
};
export type Order = {
  id: string;
  status: OrderStatus;
  deferred: boolean;
  revoked: boolean;
  totalTwd: number;
  paidTwd: number | null;
  payMethod: "cash" | "transfer" | "vip" | "online" | "free" | null;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  memberName: string;
  /** 付費報名當下的真實姓名快照（對帳用；只有本人與審核人員／管理員看得到）。 */
  legalName?: string | null;
  /** 付款代碼（付費報名才有）：匯款備註填寫，對帳以代碼為準。 */
  payRef?: string | null;
  /** 會員 ID（對方改名後仍可用它認出同一個人）。 */
  memberSub?: string;
  centerLabel: string;
  hglobal: boolean;
  items: { courseId: string; runId: string | null; title: string; priceTwd: number }[];
  /** 以下只在單筆明細提供。 */
  events?: OrderEvent[];
  /** 這位學員所屬中心的收費窗口姓名。 */
  collectors?: string[];
  canReview?: boolean;
  canRevoke?: boolean;
};

export type Duty = "register" | "collect" | "review";
export const DUTY_LABELS: Record<Duty, string> = { register: "報名窗口", collect: "收費窗口", review: "審核員" };
export type ReviewGroup = {
  id: string;
  name: string;
  /** null＝總部群組（只有秘書與超級管理員可管理）。 */
  ownerCenter: string | null;
  courses: { id: string; title: string }[];
  members: { centerKey: string; centerLabel: string; memberSub: string; memberName: string; duty: Duty }[];
  canManage: boolean;
};

export type Notice = { id: string; title: string; body: string; link: string; read: boolean; createdAt: string };

/** demo 的 url 可能是相對路徑（以 API 網域為準），App 端以 resolveUrl 轉成完整網址。hls 為 Mux 簽名播放網址。 */
type Segment = { start: number | null; end: number | null };
export type Playback = Segment &
  ({ kind: "demo"; url: string; label: string } | { kind: "youtube"; videoId: string } | { kind: "hls"; url: string } | { kind: "audio"; url: string });

export type AppConfig = { demoLogin: boolean };

export type MuxAsset = {
  assetId: string;
  title: string;
  durationSeconds: number | null;
  createdAt: string | null;
  status: string;
  signedPlaybackId: string | null;
  thumbnailUrl: string | null;
};
export type MuxAssetPage = { assets: MuxAsset[]; nextCursor: string | null };

export type ApiError = { error: { code: string; message: string } };

export const HQ_UNIT = "寰宇總部";

export const DEMO_MEMBERS: { sub: string; name: string; rankCode: string; role: Role; roles?: string[]; hglobal?: boolean; center?: string }[] = [
  { sub: "demo-student", name: "測試學員", rankCode: "platinum", role: "student", hglobal: true, center: "台北中心" },
  { sub: "demo-silver", name: "測試學員（銀章）", rankCode: "silver", role: "student", hglobal: true, center: "台中中心" },
  { sub: "demo-outsider", name: "測試學員（非寰宇）", rankCode: "none", role: "student" },
  { sub: "demo-desk", name: "測試窗口", rankCode: "gold", role: "student", hglobal: true, center: "台北中心" },
  { sub: "demo-president", name: "測試會長", rankCode: "emerald", role: "student", roles: ["president"], hglobal: true, center: "台北中心" },
  { sub: "demo-admin", name: "測試管理員", rankCode: "diamond", role: "admin", roles: ["super_admin"], hglobal: true },
];

export type CourseComment = {
  id: string;
  courseId: string;
  authorName: string;
  mine: boolean;
  body: string;
  hidden: boolean;
  createdAt: string;
  /** 以下只在管理員的檢舉清單提供。 */
  reports?: number;
  courseTitle?: string;
};

/** 通知設定：Email 的正本在會員中心「聯絡信箱」，這裡只是同一個欄位的入口。 */
export type NotificationSettings = {
  email: string | null;
  notifyEmail: boolean;
  /** 伺服器是否已啟用寄信（未啟用時畫面提示「Email 通知尚未開放」）。 */
  emailReady: boolean;
  source: "central" | "local";
};

/** 附件類型：上傳檔案依副檔名判斷，網址依網域判斷；畫面依類型顯示圖示。 */
export type AttachmentType =
  | "youtube"
  | "vimeo"
  | "canva"
  | "google_slides"
  | "google_docs"
  | "google_sheets"
  | "google_forms"
  | "google_drive"
  | "notion"
  | "web"
  | "pdf"
  | "word"
  | "ppt"
  | "excel"
  | "zip"
  | "image"
  | "text"
  | "file";

/**
 * 章節附件教材：上傳檔案（kind=file，url 為 1 小時內有效的簽名下載網址）或外部網址（kind=link，url 為原網址）。
 * name 是管理員自訂的顯示標題；url 只給已開通學員與管理員。
 */
export type Attachment = { id: string; name: string; kind: "file" | "link"; type: AttachmentType; size: number; url?: string };

/** 刪除課程前的影響統計（有報名紀錄時，畫面要求輸入 YES 才能刪除）。 */
export type CourseDeleteImpact = { title: string; registrations: number; pending: number; opened: number; students: number; comments: number; paidTwd: number };

/** 刪除場次前的影響統計。lessons＝屬於這個場次的專屬章節數（會一併刪除）。 */
export type RunDeleteImpact = { title: string; courseTitle: string; registrations: number; pending: number; opened: number; students: number; lessons: number; paidTwd: number };

/** 封面底圖圖庫的一張圖。uploaderName／uploaderCenter 只在管理人員開啟圖庫時提供。 */

/** 首頁跑馬燈公告（只有超級管理員與總部秘書可管理）。 */
export type Announcement = { id: string; text: string; enabled: boolean };

/** 「完善資料」視窗的內容：真實姓名、Email，以及勾選 Amway 會員時的系統、中心、獎銜。 */
export type ProfileForm = {
  legalName: string;
  /** 暱稱（中央會員的 display_name）。 */
  nickname: string;
  email: string;
  enabled: boolean;
  hglobal: boolean;
  /** 中央標為寰宇的「培訓系統」詞（選到其中一個，中心改用中心清單）。 */
  hglobalSystems: string[];
  fields: Record<"education_system" | "education_center" | "rank", { value: string; pending: string | null; status: string }>;
  rankOptions: { value: string; label: string }[];
};

// ---------- 學習成就（徽章）----------
export type AchievementType = "lessons_completed" | "courses_completed" | "courses_enrolled" | "learning_days" | "comments_posted" | "course_completed";
/** 條件類型的中文說明（單位用在「累計 N ○」）。 */
export const ACHIEVEMENT_TYPES: Record<AchievementType, { label: string; unit: string; needsCourse?: boolean }> = {
  lessons_completed: { label: "累計完成幾堂課", unit: "堂" },
  courses_completed: { label: "累計完整學完幾門課程", unit: "門" },
  courses_enrolled: { label: "累計報名（已開通）幾門課程", unit: "門" },
  learning_days: { label: "累計幾個不同的日子有學習紀錄", unit: "天" },
  comments_posted: { label: "在課程留言板留言幾次", unit: "次" },
  course_completed: { label: "學完指定的某一門課程", unit: "門", needsCourse: true },
};
/** 會員看到的徽章：已取得或尚未取得（含目前進度）。 */
export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: AchievementType;
  threshold: number;
  courseTitle: string | null;
  current: number;
  earned: boolean;
  earnedAt: string | null;
};
/** 超級管理員設定徽章用。 */
export type AdminAchievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: AchievementType;
  threshold: number;
  courseId: string | null;
  courseTitle: string | null;
  active: boolean;
  earnedCount: number;
};
