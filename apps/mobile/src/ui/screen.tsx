import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { maxContentWidth, space } from "@/theme/tokens";
import { AppText } from "./text";

/**
 * 分頁頁面的外框：處理安全區、背景色、網頁最大寬度與大標題。
 * 推入的詳情頁使用系統導覽列，傳入 `header={false}`。
 */
export function Screen({
  title,
  subtitle,
  right,
  children,
  header = true,
  tight = false,
  gap = space.lg,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  header?: boolean;
  /** 上方留白縮小（內容要貼近上方影片時用）。 */
  tight?: boolean;
  /** 各區塊之間的間距（預設 space.lg）。 */
  gap?: number;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { member, refreshMember, invalidate } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  // 手機下拉重新整理：重新向會員中心拿最新獎銜與資料，並重新載入這一頁的清單（App 沒有重新整理鈕）。
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshMember(0);
      invalidate();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <ScrollView
      refreshControl={member ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} /> : undefined}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: (header ? insets.top : 0) + (tight ? space.xs : space.lg), paddingBottom: space.xxl },
      ]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={[styles.inner, { gap }]}>
        {header && (title || subtitle || right) ? (
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              {title ? (
                <AppText variant="display" accessibilityRole="header">
                  {title}
                </AppText>
              ) : null}
              {subtitle ? (
                <AppText tone="muted" variant="callout">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, alignItems: "center" },
  inner: { width: "100%", maxWidth: maxContentWidth, gap: space.lg },
  header: { flexDirection: "row", alignItems: "flex-end", gap: space.md, marginBottom: space.xs },
});
