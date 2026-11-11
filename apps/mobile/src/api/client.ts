import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { ApiError } from "../../../launch/src/contract";

export type {
  ClientPlatform,
  CourseDetail,
  CourseSummary,
  Lesson,
  Member,
  Notice,
  Order,
  OrderStatus,
  Playback,
  Rank,
} from "../../../launch/src/contract";

/** Web 與網站同網域；App 連正式網域。開發時可用 EXPO_PUBLIC_API_BASE 指向本機 Worker。 */
const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? (Platform.OS === "web" ? "" : "https://learn.hglobal1985.com");
const TOKEN_KEY = "hglobal:learn:session-token";

let token: string | null = null;

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

export async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "x-client-platform": Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v2${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new RequestError(0, "network", "網路連線不穩定，請稍後再試");
  }
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new RequestError(res.status, err?.code ?? "http_error", err?.message ?? "系統忙碌，請稍後再試");
  }
  return data as T;
}
