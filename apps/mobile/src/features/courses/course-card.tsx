import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { eventDays, plainDate } from "@/features/format";
import { useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { ribbonsFor } from "./ribbons";
import { SeriesSheet } from "./series-sheet";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Card, CornerRibbon, CourseCover, Pill } from "@/ui";

export function CourseCard({ course, siblings = [] }: { course: CourseSummary; siblings?: CourseSummary[] }) {
  const { c } = useTheme();
  const [sheet, setSheet] = useState(false);
  const { member } = useSession();
  // 緞帶：左上角＝資格或狀態、右上角＝日期倒數；文字與顏色由超級管理員在「課程排序與條件」設定。
  const { config } = useUiConfig();
  const ribbons = ribbonsFor(course, member, config);
  const ratio = course.lessonCount ? course.completedLessons / course.lessonCount : 0;
  return (
    <Card onPress={() => router.push(`/course/${course.id}`)} accessibilityLabel={course.title}>
      <View style={styles.coverWrap}>
        <CourseCover theme={course.theme} label={course.category} title={course.title} imageUrl={course.coverUrl} height={160} />
        {ribbons.left ? <CornerRibbon label={ribbons.left.label} bg={ribbons.left.bg} fg={ribbons.left.fg} side="left" /> : null}
        {ribbons.right ? <CornerRibbon label={ribbons.right.label} bg={ribbons.right.bg} fg={ribbons.right.fg} side="right" /> : null}
      </View>
      <View style={styles.titleRow}>
        <AppText variant="headline" style={{ flex: 1 }}>
          {course.title}
        </AppText>
        {course.eventStart ? (
          <AppText variant="callout" tone="muted" style={styles.date}>
            {eventDays(course.eventStart, course.eventEnd)}
          </AppText>
        ) : null}
      </View>
      <UnitTags course={course} />
      {course.location && !course.locationNone ? (
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          地點：{course.location}
        </AppText>
      ) : null}
      <View style={styles.meta}>
        <CoursePriceTag course={course} />
        {course.minRank.order > 10 ? <Pill label={`${course.minRank.name}以上`} tone={course.eligible ? "neutral" : "warning"} /> : null}
        {course.status !== "published" ? <Pill label="未上架" tone="danger" /> : null}
        <AppText variant="caption" tone="muted">
          {course.lessonCount ? `${course.lessonCount} 堂` : ""}{course.lessonCount && course.totalMinutes ? " · " : ""}{course.totalMinutes ? `約 ${course.totalMinutes} 分鐘` : ""}
        </AppText>
      </View>
      {course.enrollment === "opened" ? (
        <View style={[styles.track, { backgroundColor: c.surfaceMuted }]} accessibilityLabel={`已完成 ${course.completedLessons}/${course.lessonCount}`}>
          <View style={[styles.bar, { backgroundColor: c.accent, width: `${ratio * 100}%` }]} />
        </View>
      ) : null}
      {siblings.length ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`還有 ${siblings.length} 個梯次，點開查看`} onPress={() => setSheet(true)} style={[styles.more, { borderColor: c.accent }]}>
          <AppText variant="callout" style={{ color: c.accent, fontWeight: "700", flex: 1 }}>
            還有 {siblings.length} 個梯次
          </AppText>
          <AppText style={{ color: c.accent, fontWeight: "700" }}>›</AppText>
        </Pressable>
      ) : null}
      {sheet ? <SeriesSheet title={course.series || course.title} items={[course, ...siblings].sort((a, b) => (b.eventStart ?? "").localeCompare(a.eventStart ?? ""))} onClose={() => setSheet(false)} /> : null}
    </Card>
  );
}

/** 價格標籤：iOS/Android 由 API 隱藏價格（priceTwd 為 null），只顯示「學員專屬」。 */
export function CoursePriceTag({ course }: { course: CourseSummary }) {
  if (course.enrollment === "opened") return <Pill label="已開通" tone="success" />;
  if (course.enrollment === "pending") return <Pill label="待審核" tone="warning" />;
  if (course.priceTba) return <Pill label="費用尚未公布" tone="warning" />;
  if (course.diamondFreeNow) return <Pill label="鑽石免費" tone="accent" />;
  if (course.earlyBird?.active && course.earlyBird.priceTwd != null && !course.free) return <Pill label={`早鳥 NT$${course.earlyBird.priceTwd.toLocaleString()}（至 ${plainDate(course.earlyBird.until)}）`} tone="warning" />;
  if (course.freeNow) return <Pill label="限時免費" tone="accent" />;
  if (course.free) return <Pill label="免費" tone="accent" />;
  if (course.priceTwd !== null) return <Pill label={`NT$${course.priceTwd.toLocaleString()}${course.diamondFree ? "・鑽石免費" : ""}`} />;
  return <Pill label="學員專屬" />;
}

/** 指導單位、主辦單位兩個標籤。 */
export function UnitTags({ course }: { course: CourseSummary }) {
  if (!course.guidanceUnit && !course.hostUnit) return null;
  return (
    <View style={styles.meta}>
      {course.guidanceUnit ? <Pill label={`指導：${course.guidanceUnit}`} tone="accent" /> : null}
      {course.hostUnit ? <Pill label={`主辦：${course.hostUnit}`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  more: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: space.md, borderWidth: 1.5, borderStyle: "dashed", borderRadius: radius.md },
  coverWrap: { borderRadius: radius.md, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  date: { textAlign: "right", flexShrink: 0, paddingTop: 2 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  bar: { height: 6, borderRadius: radius.pill },
});
