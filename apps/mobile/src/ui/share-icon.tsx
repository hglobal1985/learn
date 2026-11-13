import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform } from "react-native";

/** 是否為 Apple 平台（iPhone、iPad、Mac；原生 iOS 或網頁在這些裝置的瀏覽器）。 */
export const isApplePlatform = (): boolean => {
  if (Platform.OS === "ios") return true;
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return /Mac|iPad|iPhone|iPod/.test(navigator.userAgent); // Mac 與 iOS 使用相同的分享圖示
};

/**
 * 分享圖示：永遠使用各平台系統預設的分享圖案——
 * iOS＝方框加向上箭頭（share-outline）；Android 與其他＝三個圓點相連（share-social-outline）。
 * 全站所有「分享」按鈕都用這個元件，不要自己畫別的圖示。
 */
export function ShareIcon({ size = 24, color }: { size?: number; color: string }) {
  return <Ionicons name={isApplePlatform() ? "share-outline" : "share-social-outline"} size={size} color={color} />;
}
