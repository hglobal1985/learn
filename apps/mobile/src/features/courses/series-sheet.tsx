import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { eventDays } from "@/features/format";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button, Pill } from "@/ui";
import { BottomSheet } from "@/ui/bottom-sheet";
import { dateState } from "./ribbons";

function statusPill(c: CourseSummary) {
  if (c.enrollment === "opened") return <Pill label="已開通" tone="success" />;
  if (c.enrollment === "pending") return <Pill label="審核中" tone="warning" />;
  const ds = dateState(c);
  if (ds === "ended") return <Pill label="已結束" />;
  if (ds === "running") return <Pill label="進行中" tone="accent" />;
  return <Pill label={c.priceTba ? "費用尚未公布" : "尚未開始"} tone={c.priceTba ? "warning" : "neutral"} />;
}

/** 「還有 N 個梯次」：從下方彈出，列出同系列所有梯次（日期＋狀態），點一列進入那一場的課程頁。 */
export function SeriesSheet({ title, items, onClose }: { title: string; items: CourseSummary[]; onClose: () => void }) {
  const { c } = useTheme();
  return (
    <BottomSheet onClose={onClose}>
      <AppText variant="headline">{title}　全部梯次</AppText>
      <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 0 }}>
        {items.map((x) => (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={`${x.title} ${x.eventStart ?? ""}`}
            onPress={() => {
              onClose();
              router.push(`/course/${x.id}`);
            }}
            style={[styles.row, { borderTopColor: c.border }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="callout" style={{ fontWeight: "700" }}>
                {x.eventStart ? eventDays(x.eventStart, x.eventEnd) : "未設定日期"}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {x.title}
              </AppText>
            </View>
            {statusPill(x)}
            <AppText tone="muted">›</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <Button variant="secondary" label="關閉" onPress={onClose} fullWidth />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: minTouch + 8, borderTopWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
