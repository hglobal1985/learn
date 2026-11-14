import { Stack } from "expo-router";
import { HeaderShare } from "./share-button";

/**
 * 有「分享」的頁面共用的上方工具列：標題＋靠右「分享圖示＋分享」文字按鈕。
 * 課程詳細頁、短網址頁（分類／系列）、系列頁都用這一個；要改工具列的分享區，只改這個檔案與 share-button.tsx，
 * 返回鍵、高度、陰影等整體樣式則在 app/_layout.tsx 的 screenOptions，全站一起連動。
 * path＝要分享的網址路徑（有短網址就傳 /縮寫）。
 */
export function PageHeader({ title, path, shareTitle }: { title: string; path: string; shareTitle?: string }) {
  return <Stack.Screen options={{ title, headerRight: () => <HeaderShare title={shareTitle ?? title} path={path} /> }} />;
}
