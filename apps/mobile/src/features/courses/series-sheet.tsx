import { router } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { resolveUrl, type CourseSummary } from "@/api/client";
import { eventDays } from "@/features/format";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button } from "@/ui";
import { BottomSheet } from "@/ui/bottom-sheet";
import { ribbonsFor } from "./ribbons";
import { useApi, useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { startOf } from "./sort";
import { todayStr } from "@/ui/date-select";

/** 梯次排序：還沒結束的（日期最近的在上、最晚的在下）排前面，已結束的接在後面（最近結束的在前），沒有日期的放最後。 */
export function byNearest(items: CourseSummary[]): CourseSummary[] {
  const today = todayStr();
  const rank = (c: CourseSummary) => {
    const d = startOf(c);
    if (!d) return 2;
    return (c.eventEnd ?? d) >= today ? 0 : 1;
  };
  return [...items].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const da = startOf(a) ?? "";
    const db = startOf(b) ?? "";
    return ra === 0 ? da.localeCompare(db) : db.localeCompare(da);
  });
}
/** 選單顯示順序：日期較遠的在上、較近的在下（與 byNearest 相反）。 */
const farToNear = (items: CourseSummary[]) => byNearest(items).reverse();

/** 狀態標籤：與課程卡左邊緞帶同步的文字與顏色；沒有左緞帶時用右邊緞帶（倒數、進行中…）。 */
function StatusChip({ course }: { course: CourseSummary }) {
  const { member } = useSession();
  const { config } = useUiConfig();
  const r = ribbonsFor(course, member, config);
  const rb = r.left ?? r.right;
  if (!rb) return null;
  return (
    <View style={[styles.chip, { backgroundColor: rb.bg }]}>
      <AppText variant="caption" style={{ color: rb.fg, fontWeight: "800" }} numberOfLines={1}>
        {rb.label}
      </AppText>
    </View>
  );
}

/** 「還有 N 個梯次」：從下方彈出，列出同系列所有梯次（日期＋狀態），點一列進入那一場的課程頁。 */
export function SeriesSheet({ title, items, onClose, onPick, currentId, showAllSeries }: { title: string; items: CourseSummary[]; onClose: () => void; onPick?: (c: CourseSummary) => void; currentId?: string; showAllSeries?: string }) {
  const { c } = useTheme();
  const links = useApi<{ kind: string; value: string; slug: string }[]>(showAllSeries ? "/short-links" : null);
  /** 顯示該系列全部梯次（全部展開）：有設定短網址就用短網址，沒有用 /courses?series=。 */
  const showAll = () => {
    onClose();
    const slug = links.data?.find((l) => l.kind === "series" && l.value === showAllSeries)?.slug;
    if (slug) router.push(`/${slug}`);
    else router.push({ pathname: "/courses", params: { series: showAllSeries } });
  };
  return (
    <BottomSheet onClose={onClose}>
      <View style={styles.head}>
        <AppText variant="headline" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </AppText>
        {showAllSeries ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`顯示「${showAllSeries}」全部梯次`} onPress={showAll} style={[styles.showAll, { backgroundColor: c.accent }]}>
            <AppText variant="callout" style={{ color: c.textOnAccent, fontWeight: "800" }} numberOfLines={1}>
              顯示全部
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 0 }}>
        {farToNear(items).map((x) => (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={`${x.title} ${x.eventStart ?? ""}`}
            onPress={() => {
              onClose();
              if (onPick) onPick(x);
              else router.push(`/course/${x.id}`);
            }}
            style={[styles.row, { borderTopColor: c.border }]}
          >
            {x.coverUrl || x.edmUrl ? (
              <Image source={{ uri: resolveUrl((x.coverUrl || x.edmUrl) as string) }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <Image source={require("../../../assets/icon.png")} style={styles.thumb} resizeMode="cover" />
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="body" style={{ fontWeight: "700" }}>
                {x.eventStart ? eventDays(x.eventStart, x.eventEnd) : "未設定日期"}{x.id === currentId ? "（目前顯示）" : ""}
              </AppText>
              <AppText variant="callout" tone="muted" numberOfLines={1}>
                {x.title}
              </AppText>
            </View>
            <StatusChip course={x} />
            <AppText tone="muted">›</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <Button variant="secondary" label="關閉" onPress={onClose} fullWidth />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  showAll: { minHeight: minTouch, paddingHorizontal: space.lg, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, maxWidth: 120 },
  thumb: { width: 64, height: 36, borderRadius: radius.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: minTouch + 12, borderTopWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
