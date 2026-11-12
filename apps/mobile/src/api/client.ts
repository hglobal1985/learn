import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { ApiError } from "../../../launch/src/contract";
export { DUTY_LABELS, HQ_UNIT, REVIEW_REASONS } from "../../../launch/src/contract";
import { centralToken, refresh as refreshCentral } from "./central";

export type {
  AppConfig,
  Attachment,
  ClientPlatform,
  CourseComment,
  CourseDeleteImpact,
  CourseDetail,
  CourseRun,
  Duty,
  OrderEvent,
  ReviewAction,
  ReviewGroup,
  ReviewReason,
  CourseSummary,
  Lesson,
  MediaType,
  Member,
  MuxAsset,
  MuxAssetPage,
  Notice,
  NotificationSettings,
  Order,
  OrderStatus,
  Playback,
  Rank,
} from "../../../launch/src/contract";

/** Web 與網站同網域；App 連正式網域。開發時可用 EXPO_PUBLIC_API_BASE 指向本機 Worker。 */
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? (Platform.OS === "web" ? "" : "https://learn.hglobal1985.com");
/** 模擬會員（內部測試）的 token；中央會員的 token 由 central.ts 管理。 */
const TOKEN_KEY = "hglobal:learn:session-token";

let token: string | null = null;

/** 把 API 回傳的相對路徑（例如 /media/x.mp4）轉成完整網址；Web 版維持同網域相對路徑。 */
export function resolveUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${API_BASE}${url}`;
}

export async function loadToken(): Promise<string | null> {
  token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  return token;
}
export async function saveToken(value: string | null): Promise<void> {
  token = value;
  if (value) await AsyncStorage.setItem(TOKEN_KEY, value).catch(() => undefined);
  else await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}

export class RequestError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, retried = false): Promise<T> {
  const raw = typeof Blob !== "undefined" && body instanceof Blob;
  const headers: Record<string, string> = { "x-client-platform": Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web" };
  const central = token ? null : await centralToken();
  const bearer = token ?? central;
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (body !== undefined) headers["content-type"] = raw ? "application/octet-stream" : "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v2${path}`, { method, headers, body: body === undefined ? undefined : raw ? (body as Blob) : JSON.stringify(body) });
  } catch {
    throw new RequestError(0, "network", "網路連線不穩定，請稍後再試");
  }
  // 中央 Access Token 過期：換發一次後重試。
  if (res.status === 401 && central && !retried && (await refreshCentral())) return api<T>(method, path, body, true);
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new RequestError(res.status, err?.code ?? "http_error", err?.message ?? "系統忙碌，請稍後再試");
  }
  return data as T;
}

/** 下載需要登入的檔案（例如 CSV 報表）；只在 Web 使用。 */
export async function download(path: string, fileName: string): Promise<void> {
  const bearer = token ?? (await centralToken());
  const res = await fetch(`${API_BASE}/api/v2${path}`, { headers: { "x-client-platform": "web", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) } });
  if (!res.ok) throw new RequestError(res.status, "download", "下載失敗，請稍後再試");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
