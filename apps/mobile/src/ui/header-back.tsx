import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";
import { Pressable } from "react-native";
import { useTheme } from "@/theme/theme";

/** 上方標題列的返回鍵：只要有標題列就一定有。能返回就返回上一頁；沒有上一頁（直接開連結、重新整理）就回到對應的主分頁。 */
export function HeaderBack() {
  const { c } = useTheme();
  const path = usePathname();
  const fallback = path.startsWith("/course") || path.startsWith("/learn") ? "/courses" : path.startsWith("/orders") || path.startsWith("/admin") || path.startsWith("/settings") || path.startsWith("/achievements") ? "/me" : "/";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="返回上一頁"
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: -8 }}
    >
      <Ionicons name="arrow-back" size={26} color={c.text} />
    </Pressable>
  );
}
