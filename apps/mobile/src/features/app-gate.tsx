import Constants from "expo-constants";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Linking, Platform, StyleSheet, View } from "react-native";
import { appStatus, isOutdated, type AppStatus } from "@/api/central";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Button, EmptyState } from "@/ui";

const STORE_URL = Platform.select({
  // App Store 上架取得 App ID 後改成商店網址。
  ios: "https://learn.hglobal1985.com",
  android: "https://play.google.com/store/apps/details?id=com.hglobal1985.learn",
  default: "https://learn.hglobal1985.com",
});

/**
 * 啟動與回到前景時查詢會員中心的 App 狀態：paused 顯示維護中、killed 停止使用、版本過舊要求更新。
 * 連不上時照常顯示（需要登入的功能會由伺服器拒絕）。
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const [status, setStatus] = useState<AppStatus | null>(null);
  useEffect(() => {
    const check = () => appStatus().then(setStatus).catch(() => undefined);
    check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => sub.remove();
  }, []);
  const version = Constants.expoConfig?.version ?? "0.0.0";
  let gate: ReactNode = null;
  if (status?.status === "paused")
    gate = <EmptyState icon="construct-outline" title="系統維護中" body="我們正在進行維護，請稍後再回來。" />;
  else if (status?.status === "killed") gate = <EmptyState icon="close-circle-outline" title="服務已停止" body="此服務目前已停止提供。" />;
  else if (status && Platform.OS !== "web" && isOutdated(version, status.min_version))
    gate = (
      <EmptyState
        icon="cloud-download-outline"
        title="請更新到最新版本"
        body="目前的版本已不再支援，更新後即可繼續使用。"
        action={<Button label="前往更新" onPress={() => Linking.openURL(STORE_URL)} />}
      />
    );
  if (!gate) return <>{children}</>;
  return <View style={[styles.fill, { backgroundColor: c.background }]}>{gate}</View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, justifyContent: "center", padding: space.lg } });
