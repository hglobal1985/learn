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
  enrollment: EnrollmentState;
  completedLessons: number;
};

export type MediaType = "demo" | "youtube" | "mux" | "audio";
export type Lesson = {
  id: string;
  position: number;
  title: string;
  minutes: number;
  completed: boolean;
  kind: "video" | "audio";
  /** 時間軸分段（秒）：同一支影片切成多堂時使用；null 表示從頭／播到結束。 */
  start: number | null;
  end: number | null;
  /** 只有管理員會拿到（編輯影片來源用）。 */
  media?: { type: MediaType; ref: string | null };
};
export type CourseDetail = CourseSummary & { description: string; lessons: Lesson[] };

export type OrderStatus = "pending" | "opened" | "rejected";
export type Order = {
  id: string;
  status: OrderStatus;
  totalTwd: number;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  memberName: string;
  items: { courseId: string; title: string; priceTwd: number }[];
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

export const DEMO_MEMBERS: { sub: string; name: string; rankCode: string; role: Role }[] = [
  { sub: "demo-student", name: "測試學員", rankCode: "platinum", role: "student" },
  { sub: "demo-silver", name: "測試學員（銀章）", rankCode: "silver", role: "student" },
  { sub: "demo-admin", name: "測試管理員", rankCode: "diamond", role: "admin" },
];
