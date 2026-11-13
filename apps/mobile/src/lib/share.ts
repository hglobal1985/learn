import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";
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

/**
 * 分享「圖片本身」（不是網址）：呼叫系統分享選單，直接把圖片檔傳出去。
 * 網頁：Web Share 的檔案分享（手機瀏覽器支援）；這個瀏覽器不能傳檔案時退而求其次分享連結，連分享選單都沒有（電腦）就複製連結。
 * App：先下載到暫存，再交給系統分享選單。
 */
export async function shareImage(title: string, url: string, fileName = "poster.jpg"): Promise<"shared" | "copied" | "cancelled"> {
  const link = absolute(url);
  if (Platform.OS !== "web") {
    try {
      const file = await File.downloadFileAsync(link, new Directory(Paths.cache));
      await Sharing.shareAsync(file.uri, { mimeType: "image/jpeg", dialogTitle: title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    const blob = await (await fetch(link)).blob();
    const file = new window.File([blob], fileName, { type: blob.type || "image/jpeg" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return "cancelled"; // 使用者關掉選單
  }
  return shareLink(title, url);
}

/** 下載圖片：網頁直接觸發瀏覽器下載；App 交給系統分享選單（可選「儲存圖片」）。 */
export async function downloadImage(url: string, fileName: string): Promise<void> {
  if (Platform.OS !== "web") {
    await shareImage(fileName, url, fileName);
    return;
  }
  const blob = await (await fetch(absolute(url))).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
