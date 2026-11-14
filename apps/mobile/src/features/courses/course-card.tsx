import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { eventDays, hostLine, placeText, plainDate } from "@/features/format";
import { useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { ribbonsFor } from "./ribbons";
import { SeriesSheet } from "./series-sheet";
import { displayName } from "./sort";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Card, CornerRibbon, CourseCover, Pill } from "@/ui";

export function CourseCard({ course, siblings = [], footer, onPress, onPickSibling, onHide }: { course: CourseSummary; siblings?: CourseSummary[]; footer?: React.ReactNode; onPress?: () => void; onPickSibling?: (c: CourseSummary) => void; onHide?: () => void }) {
  const { c } = useTheme();
  const [sheet, setSheet] = useState(false);
  const { member } = useSession();
  // 緞帶：左上角＝資格或狀態、右上角＝日期倒數；文字與顏色由超級管理員在「課程排序與條件」設定。
  const { config } = useUiConfig();
  const ribbons = ribbonsFor(course, member, config);
  const ratio = course.progressPercent / 100;
  return (
    <Card onPress={onPress ?? (() => router.push(`/course/${course.id}`))} accessibilityLabel={displayName(course)}>
      <View style={styles.coverWrap}>
        <CourseCover theme={course.theme} label={course.category} title={displayName(course)} imageUrl={course.coverUrl} />
        {ribbons.left ? <CornerRibbon label={ribbons.left.label} bg={ribbons.left.bg} fg={ribbons.left.fg} side="left" /> : null}
        {ribbons.right ? <CornerRibbon label={ribbons.right.label} bg={ribbons.right.bg} fg={ribbons.right.fg} side="right" /> : null}
      </View>
      {/* 資訊列（全站課程資訊卡的統一格式，學習中／系列頁／管理清單共用這一個元件）：
          左邊最多三個標籤＝主講人姓名、主辦、價格（或已開通等狀態），日期靠右在同一列。 */}
      <View style={styles.infoRow}>
        <View style={styles.meta}>
          {course.teacher.trim() ? <Pill label={course.teacher.trim()} /> : null}
          {hostLine(course) ? <Pill label={hostLine(course)} tone="accent" /> : null}
          <CoursePriceTag course={course} />
        </View>
        {course.eventStart ? (
          <AppText variant="callout" tone="muted" style={styles.date}>
            {eventDays(course.eventStart, course.eventEnd)}
          </AppText>
        ) : null}
      </View>
      {placeText(course) ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          地點：{placeText(course)}
        </AppText>
      ) : null}
      {course.enrollment === "opened" || course.started ? (
        <View style={styles.progressRow} accessibilityLabel={`學習進度 ${course.progressPercent}%`}>
          <View style={[styles.track, { backgroundColor: c.surfaceMuted }]}>
            <View style={[styles.bar, { backgroundColor: c.accent, width: `${ratio * 100}%` }]} />
          </View>
          <AppText variant="callout" tone="muted" style={styles.percent}>
            {course.progressPercent}%
          </AppText>
        </View>
      ) : null}
      {footer}
      {siblings.length ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`還有 ${siblings.length} 個梯次，點開查看`} onPress={() => setSheet(true)} style={[styles.more, { borderColor: c.accent }]}>
          <AppText variant="callout" style={{ color: c.accent, fontWeight: "700", flex: 1 }}>
            還有 {siblings.length} 個梯次
          </AppText>
          <AppText style={{ color: c.accent, fontWeight: "700" }}>›</AppText>
        </Pressable>
      ) : null}
      {onHide ? (
        <Pressable accessibilityRole="button" accessibilityLabel="從學習中隱藏" onPress={onHide} hitSlop={6} style={styles.hide}>
            <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      ) : null}
      {sheet ? <SeriesSheet title={course.series || course.title} items={[course, ...siblings].sort((a, b) => (b.eventStart ?? "").localeCompare(a.eventStart ?? ""))} onClose={() => setSheet(false)} onPick={onPickSibling} currentId={course.id} /> : null}
    </Card>
  );
}

/** 價格標籤：iOS/Android 由 API 隱藏價格（priceTwd 為 null），只顯示「學員專屬」。 */
export function CoursePriceTag({ course }: { course: CourseSummary }) {
  // 已開通的課程不寫「已開通」：付費課程顯示亮色的「已付費」（不寫金額），免費課程顯示「免費」（與旁邊的標籤同色）。
  if (course.enrollment === "opened") return course.paid ? <Pill label="已付費" tone="bright" /> : <Pill label="免費" tone="accent" />;
  if (course.enrollment === "pending") return <Pill label="待審核" tone="warning" />;
  if (course.priceTba) return <Pill label="費用尚未公布" tone="warning" />;
  if (course.diamondFreeNow) return <Pill label="鑽石免費" tone="accent" />;
  if (course.earlyBird?.active && course.earlyBird.priceTwd != null && !course.free) return <Pill label={`早鳥 NT$${course.earlyBird.priceTwd.toLocaleString()}（至 ${plainDate(course.earlyBird.until)}）`} tone="warning" />;
  if (course.freeNow) return <Pill label="限時免費" tone="accent" />;
  if (course.free) return <Pill label="免費" tone="accent" />;
  if (course.priceTwd !== null) return <Pill label={`NT$${course.priceTwd.toLocaleString()}${course.diamondFree ? "・鑽石免費" : ""}`} />;
  return <Pill label="學員專屬" />;
}

const styles = StyleSheet.create({
  hide: { position: "absolute", top: -12, right: -8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", zIndex: 5 },
  more: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: space.md, borderWidth: 1.5, borderStyle: "dashed", borderRadius: radius.md },
  coverWrap: { borderRadius: radius.md, overflow: "hidden" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  percent: { minWidth: 44, textAlign: "right", fontVariant: ["tabular-nums"] },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  date: { textAlign: "right", flexShrink: 0, paddingTop: 2 },
  meta: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs + 2 },
  track: { flex: 1, height: 6, borderRadius: radius.pill, overflow: "hidden" },
  bar: { height: 6, borderRadius: radius.pill },
});
