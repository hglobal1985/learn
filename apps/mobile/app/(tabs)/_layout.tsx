import { Tabs } from "expo-router/tabs";

/**
 * 五個分頁的容器。分頁列本身改由根版面的 BottomBar 顯示（所有頁面都看得到），這裡只負責切換內容。
 * 舊版 iOS／Android 原生分頁列與 Web 版分頁列都已移除。
 */
export default function TabsLayout() {
  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="learning" />
      <Tabs.Screen name="notices" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
