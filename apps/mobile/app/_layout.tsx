import { Stack } from "expo-router/stack";
import { useEffect } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppGate } from "@/features/app-gate";
import { ConfirmSheetHost } from "@/features/confirm";
import { ToastHost } from "@/ui/toast";
import { MiniAudioBar } from "@/features/player/audio-bar";
import { PlayerLayer } from "@/features/player/player-layer";
import { SwitchSheet } from "@/features/player/switch-sheet";
import { installNoPageZoom } from "@/lib/no-page-zoom";
import { SessionProvider } from "@/state/session";
import { UiConfigProvider } from "@/state/ui-config";
import { useTheme } from "@/theme/theme";
import { BottomBar } from "@/ui";

export default function RootLayout() {
  const { scheme, c } = useTheme();
  useEffect(() => installNoPageZoom(), []);
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.surface, text: c.text, border: c.border },
  };
  return (
    <SafeAreaProvider>
      <AppGate>
      <SessionProvider>
        <UiConfigProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <View style={{ flex: 1, backgroundColor: c.background }}>
          <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", contentStyle: { backgroundColor: c.background } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "寰宇行動大學" }} />
            <Stack.Screen name="course/[id]" options={{ title: "課程介紹", headerStyle: { height: 44 } as object }} />
            <Stack.Screen name="learn/[courseId]/[lessonId]" options={{ title: "上課", headerStyle: { height: 44 } as object }} />
            <Stack.Screen name="admin/list-rules" options={{ title: "課程排序與條件" }} />
            <Stack.Screen name="admin/stats" options={{ title: "統計分析" }} />
            <Stack.Screen name="achievements" options={{ title: "學習成就" }} />
            <Stack.Screen name="admin/achievements" options={{ title: "學習成就徽章設定" }} />
            <Stack.Screen name="orders/index" options={{ title: "我的報名" }} />
            <Stack.Screen name="orders/[id]" options={{ title: "報名明細" }} />
            <Stack.Screen name="admin/orders/index" options={{ title: "報名審核" }} />
            <Stack.Screen name="admin/orders/[id]" options={{ title: "審核報名" }} />
            <Stack.Screen name="settings/notifications" options={{ title: "通知設定" }} />
            <Stack.Screen name="admin/announcements" options={{ title: "跑馬燈公告" }} />
            <Stack.Screen name="admin/quotes" options={{ title: "編輯學習金句" }} />
            <Stack.Screen name="admin/courses" options={{ title: "課程設定" }} />
            <Stack.Screen name="admin/course/[id]" options={{ title: "章節與影片" }} />
            <Stack.Screen name="admin/course-edit" options={{ title: "課程資料" }} />
            <Stack.Screen name="admin/review-groups" options={{ title: "審核群組" }} />
            <Stack.Screen name="admin/comments" options={{ title: "留言檢舉" }} />
            <Stack.Screen name="admin/mux-picker" options={{ title: "從 Mux 選擇影片" }} />
            <Stack.Screen name="auth/done" options={{ headerShown: false }} />
            <Stack.Screen name="auth/google" options={{ headerShown: false }} />
            <Stack.Screen name="auth/sso" options={{ headerShown: false }} />
          </Stack>
          </View>
          <MiniAudioBar />
          <BottomBar />
          <PlayerLayer />
          <SwitchSheet />
          <ConfirmSheetHost />
          <ToastHost />
          </View>
        </ThemeProvider>
        </UiConfigProvider>
      </SessionProvider>
      </AppGate>
    </SafeAreaProvider>
  );
}
