import { usePathname } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { barHeight } from "@/theme/tokens";

const TAB_ROOTS = new Set(["/", "/courses", "/learning", "/notices", "/me"]);

/**
 * 上方置頂標題列（返回＋分享）下緣的陰影。標題列本身的陰影會被下面的頁面內容蓋住，
 * 所以另外在標題列下緣疊一條漸層（四層由深到淺），跟底部主選單的陰影呼應。五個主分頁與登入中繼頁沒有標題列，不顯示。
 */
export function HeaderShadow() {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  if (TAB_ROOTS.has(path) || path.startsWith("/auth")) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + barHeight, zIndex: 20 }}>
      {[0.16, 0.1, 0.05, 0.02].map((o, i) => (
        <View key={i} style={{ height: 2, backgroundColor: `rgba(0,0,0,${o})` }} />
      ))}
    </View>
  );
}
