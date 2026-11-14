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
  /** 可以使用「統計分析」頁（超級管理員、總部秘書，或被超級管理員指定的職務）。 */
  canViewStats?: boolean;
};

export type EnrollmentState = "opened" | "pending" | null;

export type CourseSummary = {
  id: string;
  title: string;
  subtitle: string;
  teacher: string;
  /** 主講人的獎銜（中央獎銜代碼，沒填為空字串）與顯示名稱、職稱。 */
  teacherRank: string;
  teacherRankName: string;
  teacherTitle: string;
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
  /** 活動日期（YYYY-MM-DD）；eventEnd 只有連續 2～3 天的活動才有。 */
  eventStart: string | null;
  eventEnd: string | null;
  /** 完全公開：未登入的訪客也能瀏覽介紹與章節、觀看（只限免費課程）。 */
  isPublic: boolean;
  /** 這位會員審核中的報名編號（沒有為 null）；點「付款審核中」直接進完整的報名明細與訊息頁。 */
  pendingOrderId: string | null;
  /** 費用尚未公布：顯示「費用尚未公布」、暫不開放報名。 */
  priceTba: boolean;
  hideFromHome: boolean;
  /** 這門課「鑽石免費」（鑽石以上獎銜的會員報名免費）；diamondFreeNow＝對目前登入的這位會員已生效。 */
  /** 系列名稱（空字串＝不合併）：同系列的課，全部課程清單只顯示最近的一場。 */
  series: string;
  /** 系列專屬 EDM 網址（沒上傳為 null）。 */
  seriesEdmUrl: string | null;
  /** 設定免費、而且這位會員符合資格：不用報名就能收看。 */
  watchFree: boolean;
  /** 學員把這門免費課程從「學習中」隱藏了（再打開課程頁會恢復）。 */
  hiddenFromLearning: boolean;
  /** 播放過這門課超過 1%（或已有完成章節）：即使沒有報名紀錄也會列入「學習中」。 */
  started: boolean;
  /** 課程勾選「章節各自設定封面」：章節編輯時才會出現封面設定。 */
  chapterCovers: boolean;
  /** 付費課程（原價大於 0；限時免費、早鳥、鑽石免費仍算）。學習中的課程卡用來顯示「付費課程」標籤（不寫金額）。 */
  paid: boolean;
  /** 最近一次學習（播放、完成章節）的時間（ISO）；從沒學習過是 null。「學習中」依這個由新到舊排序。 */
  lastLearnedAt: string | null;
  diamondFree: boolean;
  diamondFreeNow: boolean;
  /** 早鳥優惠（null＝沒有設定）：until 為截止日（含當天，台灣時間）；active＝現在還在優惠期間。priceTwd 在 App 為 null。 */
  earlyBird: { priceTwd: number | null; until: string; active: boolean } | null;
  /** 上課地點；locationNone 為 true 時公開卡片不顯示。 */
  location: string;
  locationNone: boolean;
  /** 線上課程：地點顯示為「線上課程」。 */
  isOnline: boolean;
  /** 是否顯示「完整版」區塊（預設顯示）。 */
  showFull: boolean;
  /** 目前是否在限時免費期間；originalPriceTwd 為原價（App 為 null）。 */
  freeNow: boolean;
  originalPriceTwd: number | null;
  freeUntil: string | null;
  enrollment: EnrollmentState;
  completedLessons: number;
  /** 學習進度百分比（0～100）：每堂都有長度就依長度算，否則依章節數算。 */
  progressPercent: number;
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
  /** 這一堂的分享者（沒有填為空字串）。 */
  sharer: string;
  /** 分享者的獎銜（中央獎銜代碼）與顯示名稱、職稱。 */
  sharerRank: string;
  sharerRankName: string;
  sharerTitle: string;
  /** 內容已準備好（已上傳影片／音檔或設定好來源）；false＝敬請期待。 */
  ready: boolean;
  /** 時間軸分段（秒）：同一支影片切成多堂時使用；null 表示從頭／播到結束。 */
  start: number | null;
  end: number | null;
  /** locked＝尚未報名（或不符資格），不能觀看。 */
  locked: boolean;
  /** 「完整版」（同一支影片被裁成多段時自動多出的整支播放區塊），不列入章節總數與學習進度。 */
  full?: boolean;
  /** 章節自己的封面：橫式 16:9（清單縮圖）與直式；沒設定為 null（改用課程封面）。 */
  coverUrl?: string | null;
  posterUrl?: string | null;
  /** 只有管理員會拿到（編輯影片來源用）。 */
  media?: { type: MediaType; ref: string | null };
};
export type CourseDetail = CourseSummary & {
  description: string;
  lessons: Lesson[];
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
  /** series／eventStart／eventEnd／place：給學員在報名明細核對是哪一場（place＝地點，線上課程顯示「線上課程」，沒有就是 null）。 */
  items: { courseId: string; title: string; priceTwd: number; series: string; eventStart: string | null; eventEnd: string | null; place: string | null }[];
  /** 以下只在單筆明細提供。 */
  events?: OrderEvent[];
  /** 這位學員所屬中心的收費窗口姓名。 */
  collectors?: string[];
  /** 這場活動的負責審核人員姓名（同一個審核群組、同一中心）。 */
  reviewers?: string[];
  /** 學員回報的繳費方式紀錄（新的在後）。 */
  payments?: PaymentReport[];
  canReview?: boolean;
  canRevoke?: boolean;
};

export const PAYMENT_METHODS = [
  { key: "cash", label: "現金" },
  { key: "linepay", label: "LINE Pay" },
  { key: "transfer", label: "網銀轉帳" },
  { key: "friend", label: "託朋友代付" },
] as const;
export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number]["key"];
export type PaymentReport = { id: string; method: PaymentMethodKey; last5: string | null; friendName: string | null; paidAt: string | null; createdAt: string };

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

/** 申請人顯示名稱：本名＋暱稱同時顯示，例如「王小明（小明）」；兩者相同或只有一個時只顯示一個。 */
export function applicantLabel(legalName: string | null | undefined, nickname: string | null | undefined): string {
  const legal = (legalName ?? "").trim();
  const nick = (nickname ?? "").trim();
  if (legal && nick && legal !== nick) return `${legal}（${nick}）`;
  return legal || nick;
}

// ---------- 畫面設定（課程排序與緞帶）----------
/** 緞帶可選的顏色：只能用《寰宇生態系固定配色規範》的色（色碼在 App 端的 ribbon 色表）。 */
export const RIBBON_PALETTE = ["green", "greenDark", "olive", "orange", "warn", "yellow", "salmon", "danger", "ok", "muted"] as const;
export type RibbonColor = (typeof RIBBON_PALETTE)[number];

/** 課程卡片的緞帶狀態。left＝左上角（資格或狀態）、right＝右上角（日期倒數）。 */
export const RIBBON_KEYS = ["public_free", "learning", "completed", "pending", "can_register", "ineligible", "price_tba", "countdown", "in_progress", "ended"] as const;
export type RibbonKey = (typeof RIBBON_KEYS)[number];
export const RIBBON_INFO: Record<RibbonKey, { title: string; side: "left" | "right"; hint: string }> = {
  public_free: { title: "免費公開", side: "left", hint: "訪客看到完全公開的課程" },
  learning: { title: "學習中", side: "left", hint: "已報名開通、還沒學完" },
  completed: { title: "已聽完", side: "left", hint: "已報名開通、全部章節都完成" },
  pending: { title: "報名審核中", side: "left", hint: "已送出報名、等待窗口審核" },
  can_register: { title: "可以報名", side: "left", hint: "符合資格、尚未報名、開放報名" },
  ineligible: { title: "獎銜不符", side: "left", hint: "登入會員但獎銜不符合報名資格" },
  price_tba: { title: "費用尚未公布", side: "left", hint: "勾選「尚未公布」的課程" },
  countdown: { title: "倒數天數", side: "right", hint: "活動還沒開始；文字裡的 {n} 會換成天數" },
  in_progress: { title: "活動進行中", side: "right", hint: "今天正在活動日期範圍內" },
  ended: { title: "活動已結束", side: "right", hint: "活動日期已過" },
};

/** 「全部課程」的排序分組（由上到下就是優先順序）。每組內：未開課依日期由近到遠，已開課依日期由新到舊。 */
export const SORT_GROUPS = ["pending", "eligible_upcoming", "eligible_tba", "eligible_started", "public_free", "enrolled", "ineligible_upcoming", "ineligible_started"] as const;
export type SortGroup = (typeof SORT_GROUPS)[number];
export const SORT_GROUP_INFO: Record<SortGroup, { title: string; hint: string }> = {
  pending: { title: "報名審核中的課程", hint: "已送出報名、等待審核" },
  eligible_upcoming: { title: "符合資格、尚未報名・尚未開課", hint: "活動日期還沒到" },
  eligible_tba: { title: "符合資格、尚未報名・費用尚未公布", hint: "活動日期還沒到、費用還沒公布" },
  eligible_started: { title: "符合資格、尚未報名・已開課", hint: "已經開始或沒有日期" },
  public_free: { title: "公開免費的課程", hint: "完全公開、不用報名" },
  enrolled: { title: "已報名的課程", hint: "已開通（學習中、已聽完）" },
  ineligible_upcoming: { title: "不符合資格・尚未開課", hint: "獎銜不符、活動日期還沒到" },
  ineligible_started: { title: "不符合資格・已開課", hint: "獎銜不符、已開始或沒有日期" },
};

export type UiConfig = {
  sortGroups: SortGroup[];
  ribbons: Record<RibbonKey, { label: string; color: RibbonColor; enabled: boolean }>;
  /** 除了超級管理員、總部秘書之外，哪些職務可以看「統計分析」（職務代碼：president、sound、course、reviewer）。 */
  statsRoles: string[];
};
export const STATS_ROLE_OPTIONS: { key: string; title: string }[] = [
  { key: "president", title: "會長" },
  { key: "sound", title: "音控" },
  { key: "course", title: "課務" },
  { key: "reviewer", title: "審核員" },
];
export const DEFAULT_UI_CONFIG: UiConfig = {
  sortGroups: [...SORT_GROUPS],
  ribbons: {
    public_free: { label: "免費公開", color: "ok", enabled: true },
    learning: { label: "學習中", color: "green", enabled: true },
    completed: { label: "已聽完", color: "olive", enabled: true },
    pending: { label: "報名審核中", color: "orange", enabled: true },
    can_register: { label: "可以報名", color: "yellow", enabled: true },
    ineligible: { label: "獎銜不符", color: "danger", enabled: true },
    price_tba: { label: "費用尚未公布", color: "warn", enabled: true },
    countdown: { label: "倒數 {n} 天", color: "salmon", enabled: true },
    in_progress: { label: "進行中", color: "greenDark", enabled: true },
    ended: { label: "已結束", color: "muted", enabled: true },
  },
  statsRoles: [],
};

// ---------- 統計分析（Mux）----------
export type StatBlock = {
  id: string;
  title: string;
  /** core＝最常用、more＝次要、advanced＝進階（排在最後）。 */
  level: "core" | "more" | "advanced";
  note?: string;
  /** 讀不到時的原因（其他區塊不受影響）。 */
  error?: string;
  stats?: { label: string; value: string; sub?: string }[];
  bars?: { label: string; value: number; max: number; text: string }[];
  head?: string[];
  rows?: string[][];
};
export type MuxStats = { generatedAt: string; freeMinutes: number; blocks: StatBlock[] };

// ---------- 關鍵字管理（超級管理員）----------
export type KeywordKind = "category" | "series" | "location";
export type KeywordItem = { value: string; count: number; preset: boolean; edmUrl?: string | null };
export type KeywordLists = Record<KeywordKind, KeywordItem[]>;
export const KEYWORD_INFO: Record<KeywordKind, { title: string; hint: string }> = {
  category: { title: "分類", hint: "課程的分類，例如：達標班、會議" },
  series: { title: "系列", hint: "同系列的課，全部課程清單只顯示最近的一場" },
  location: { title: "場地", hint: "課程的上課地點" },
};
