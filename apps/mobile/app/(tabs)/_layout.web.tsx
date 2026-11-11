import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/tabs";
import type { ComponentProps } from "react";
import { useUnreadCount } from "@/state/unread";
import { useTheme } from "@/theme/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
const tabs: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: "index", title: "首頁", icon: "home-outline", active: "home" },
  { name: "courses", title: "課程", icon: "library-outline", active: "library" },
  { name: "learning", title: "我的課程", icon: "play-circle-outline", active: "play-circle" },
  { name: "notices", title: "通知", icon: "notifications-outline", active: "notifications" },
  { name: "me", title: "我的", icon: "person-circle-outline", active: "person-circle" },
];

/** Web：與手機相同的五個底部分頁（原生分頁在 Web 沒有圖示，所以改用 JS 分頁列）。 */
export default function TabsLayout() {
  const { c } = useTheme();
  const unreadCount = useUnreadCount();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentText,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border, height: 64 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? t.active : t.icon} color={String(color)} size={size} />,
            tabBarBadge: t.name === "notices" && unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : undefined,
            tabBarBadgeStyle: { backgroundColor: c.accent, color: c.textOnAccent },
          }}
        />
      ))}
    </Tabs>
  );
}
