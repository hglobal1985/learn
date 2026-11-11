import { Stack } from "expo-router/stack";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/state/session";
import { useTheme } from "@/theme/theme";

export default function RootLayout() {
  const { scheme, c } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.surface, text: c.text, border: c.border },
  };
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", contentStyle: { backgroundColor: c.background } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "寰宇行動大學" }} />
            <Stack.Screen name="course/[id]" options={{ title: "課程介紹" }} />
            <Stack.Screen name="learn/[courseId]/[lessonId]" options={{ title: "上課" }} />
            <Stack.Screen name="cart" options={{ title: "購物車" }} />
            <Stack.Screen name="orders/index" options={{ title: "我的訂單" }} />
            <Stack.Screen name="orders/[id]" options={{ title: "訂單明細" }} />
            <Stack.Screen name="admin/orders/index" options={{ title: "訂單審核" }} />
            <Stack.Screen name="admin/orders/[id]" options={{ title: "審核訂單" }} />
            <Stack.Screen name="admin/courses" options={{ title: "課程與獎銜設定" }} />
          </Stack>
        </ThemeProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
