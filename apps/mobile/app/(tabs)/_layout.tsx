import { NativeTabs } from "expo-router/native-tabs";
import { useUnreadCount } from "@/state/unread";
import { useTheme } from "@/theme/theme";

/** iOS / Android：系統原生分頁列（最流暢）。Web 版見 _layout.web.tsx。 */
export default function TabsLayout() {
  const { c } = useTheme();
  const unreadCount = useUnreadCount();
  return (
    <NativeTabs tintColor={c.accentText}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>首頁</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="courses">
        <NativeTabs.Trigger.Icon sf={{ default: "books.vertical", selected: "books.vertical.fill" }} md="menu_book" />
        <NativeTabs.Trigger.Label>課程</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="learning">
        <NativeTabs.Trigger.Icon sf={{ default: "play.rectangle", selected: "play.rectangle.fill" }} md="play_circle" />
        <NativeTabs.Trigger.Label>我的課程</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notices">
        <NativeTabs.Trigger.Icon sf={{ default: "bell", selected: "bell.fill" }} md="notifications" />
        <NativeTabs.Trigger.Label>通知</NativeTabs.Trigger.Label>
        {unreadCount > 0 ? <NativeTabs.Trigger.Badge>{unreadCount > 9 ? "9+" : String(unreadCount)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} md="person" />
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
