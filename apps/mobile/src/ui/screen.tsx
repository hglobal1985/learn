import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { maxContentWidth, space } from "@/theme/tokens";
import { usePullRefresh } from "./pull-refresh";
import { AppText } from "./text";

const FooterSlot = createContext<((node: ReactNode) => void) | null>(null);

/**
 * 頁面下方固定的操作列（貼在底部主選單上方，內容捲動時不會跟著跑）。
 * 在 Screen 裡面的元件呼叫，傳入要固定的按鈕列（傳 null＝不顯示）；離開頁面時自動移除。
 * 狀態在子元件裡的表單（例如繳費表單）用這個；狀態在頁面本身的，直接用 Screen 的 footer 參數。
 */
export function useScreenFooter(node: ReactNode): void {
  const set = useContext(FooterSlot);
  useEffect(() => {
    set?.(node);
  });
  useEffect(() => () => set?.(null), [set]);
}

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
  footer,
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
  /** 固定在頁面下方（底部主選單上方）的操作列，例如「報名」、「取消報名／送出」。不會跟著內容捲動。 */
  footer?: ReactNode;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const refreshControl = usePullRefresh();
  const [slot, setSlot] = useState<ReactNode>(null);
  const bar = footer ?? slot;
  return (
    <FooterSlot.Provider value={setSlot}>
    <View style={{ flex: 1 }}>
    <ScrollView
      refreshControl={refreshControl}
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
    {bar ? (
      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <View style={styles.footerInner}>{bar}</View>
      </View>
    ) : null}
    </View>
    </FooterSlot.Provider>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, alignItems: "center" },
  inner: { width: "100%", maxWidth: maxContentWidth, gap: space.lg },
  footer: { alignItems: "center", paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, borderTopWidth: 1, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: -2 }, elevation: 6 },
  footerInner: { width: "100%", maxWidth: maxContentWidth, gap: space.sm },
  header: { flexDirection: "row", alignItems: "flex-end", gap: space.md, marginBottom: space.xs },
});
