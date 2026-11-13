import { Linking, Platform, Share } from "react-native";
import { resolveUrl } from "@/api/client";

/** 絕對網址（分享與下載用）。 */
const absolute = (url: string) => {
  const u = resolveUrl(url);
  return /^https?:/.test(u) || typeof location === "undefined" ? u : `${location.origin}${u.startsWith("/") ? "" : "/"}${u}`;
};

/**
 * 分享：一律呼叫手機的系統分享選單（網頁用 Web Share、App 用系統 Share）。
 * 回傳 "shared"＝已叫出選單；"copied"＝這個瀏覽器沒有分享選單（例如電腦），已改為複製連結。
 */
export async function shareLink(title: string, url: string): Promise<"shared" | "copied" | "cancelled"> {
  const link = absolute(url);
  if (Platform.OS !== "web") {
    try {
      await Share.share({ title, message: Platform.OS === "android" ? `${title}\n${link}` : title, url: link });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url: link });
      return "shared";
    } catch {
      return "cancelled"; // 使用者關掉選單
    }
  }
  await navigator.clipboard?.writeText(link).catch(() => undefined);
  return "copied";
}

/** 下載圖片：網頁直接觸發瀏覽器下載；App 交給系統瀏覽器開啟（可長按儲存）。 */
export async function downloadImage(url: string, fileName: string): Promise<void> {
  const link = absolute(url);
  if (Platform.OS !== "web") return void (await Linking.openURL(link));
  const blob = await (await fetch(link)).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
