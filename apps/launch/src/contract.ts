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
  rank: Rank;
  role: Role;
  /** 目前所有會員都是模擬會員；串接中央會員後為 false。 */
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

export type Lesson = { id: string; position: number; title: string; minutes: number; completed: boolean };
export type CourseDetail = CourseSummary & { lessons: Lesson[] };

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

export type Playback = { kind: "demo"; url: string; label: string };

export type ApiError = { error: { code: string; message: string } };

export const DEMO_MEMBERS: { sub: string; name: string; rankCode: string; role: Role }[] = [
  { sub: "demo-student", name: "測試學員", rankCode: "platinum", role: "student" },
  { sub: "demo-silver", name: "測試學員（銀章）", rankCode: "silver", role: "student" },
  { sub: "demo-admin", name: "測試管理員", rankCode: "diamond", role: "admin" },
];
