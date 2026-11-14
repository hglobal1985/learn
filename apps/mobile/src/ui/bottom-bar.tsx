import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname, type Href } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnreadCount } from "@/state/unread";
import { useTheme } from "@/theme/theme";
import { barHeight } from "@/theme/tokens";
import { AppText } from "./text";

type IconName = ComponentProps<typeof Ionicons>["name"];
/** 短網址（/縮寫）：單層路徑且不是網站固定頁面。 */
const FIXED = new Set(["/me", "/learning", "/notices", "/achievements", "/orders", "/courses", "/admin", "/settings", "/auth"]);
const isShortLink = (p: string) => /^\/[a-z0-9-]{2,30}$/.test(p) && !FIXED.has(p);
const tabs: { href: Href; title: string; icon: IconName; active: IconName; match: (p: string) => boolean }[] = [
  { href: "/", title: "首頁", icon: "home-outline", active: "home", match: (p) => p === "/" },
  { href: "/courses", title: "全部課程", icon: "library-outline", active: "library", match: (p) => p === "/courses" || p.startsWith("/course/") || isShortLink(p) },
  { href: "/learning", title: "學習中", icon: "play-circle-outline", active: "play-circle", match: (p) => p === "/learning" || p.startsWith("/learn/") },
  { href: "/notices", title: "通知", icon: "notifications-outline", active: "notifications", match: (p) => p === "/notices" },
  { href: "/me", title: "設定", icon: "person-circle-outline", active: "person-circle", match: (p) => p === "/me" || p.startsWith("/orders") || p.startsWith("/admin") || p.startsWith("/settings") },
];

/**
 * 底部分頁列：放在根版面，所有頁面（課程、上課、報名、管理、設定…）都會顯示，不會被推入的頁面蓋掉。
 * 登入中繼頁（/auth/*）與手機鍵盤開啟時隱藏。
 */
export function BottomBar() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const unread = useUnreadCount();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => (show.remove(), hide.remove());
  }, []);
  if (pathname.startsWith("/auth") || keyboard) return null;
  return (
    <View style={[styles.bar, { backgroundColor: c.tabBar, paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.match(pathname);
        const color = on ? c.accentText : c.textMuted;
        return (
          <Pressable key={t.title} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.title} onPress={() => router.navigate(t.href)}>
            <View>
              <Ionicons name={on ? t.active : t.icon} size={24} color={color} />
              {t.title === "通知" && unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: c.accent }]}>
                  <AppText variant="caption" style={{ color: c.textOnAccent, fontSize: 10, lineHeight: 12, fontWeight: "700" }}>
                    {unread > 9 ? "9+" : String(unread)}
                  </AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption" style={{ color, fontWeight: "600", fontSize: 12 }}>
              {t.title}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", minHeight: barHeight, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: -3 }, elevation: 10 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingTop: 6, paddingBottom: 6, minHeight: barHeight },
  badge: { position: "absolute", top: -4, right: -12, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
});
