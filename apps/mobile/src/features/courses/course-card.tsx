import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { eventDays } from "@/features/format";
import { useSession } from "@/state/session";
import { daysUntilStart } from "./sort";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Card, CornerRibbon, CourseCover, Pill } from "@/ui";

export function CourseCard({ course }: { course: CourseSummary }) {
  const { c } = useTheme();
  const { member } = useSession();
  // 緞帶：訪客看到完全公開的課程 → 「免費公開」；其餘尚未開始的課程 → 「剩餘 X 天」。
  const days = daysUntilStart(course);
  const ribbon = !member && course.isPublic ? { label: "免費公開", tone: "accent" as const } : days != null ? { label: `剩餘 ${days} 天`, tone: "warning" as const } : null;
  const ratio = course.lessonCount ? course.completedLessons / course.lessonCount : 0;
  return (
    <Card onPress={() => router.push(`/course/${course.id}`)} accessibilityLabel={`${course.title}，${course.teacher}`}>
      <View style={styles.coverWrap}>
        <CourseCover theme={course.theme} label={course.category} imageUrl={course.coverUrl} />
        {ribbon ? <CornerRibbon label={ribbon.label} tone={ribbon.tone} /> : null}
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
      <AppText variant="callout" tone="muted" numberOfLines={2}>
        {course.subtitle}
      </AppText>
      <UnitTags course={course} />
      <View style={styles.meta}>
        <CoursePriceTag course={course} />
        {course.minRank.order > 10 ? <Pill label={`${course.minRank.name}以上`} tone={course.eligible ? "neutral" : "warning"} /> : null}
        {course.status !== "published" ? <Pill label="未上架" tone="danger" /> : null}
        <AppText variant="caption" tone="muted">
          {course.lessonCount} 堂{course.totalMinutes ? ` · 約 ${course.totalMinutes} 分鐘` : ""}
        </AppText>
      </View>
      {course.enrollment === "opened" ? (
        <View style={[styles.track, { backgroundColor: c.surfaceMuted }]} accessibilityLabel={`已完成 ${course.completedLessons}/${course.lessonCount}`}>
          <View style={[styles.bar, { backgroundColor: c.accent, width: `${ratio * 100}%` }]} />
        </View>
      ) : null}
    </Card>
  );
}

/** 價格標籤：iOS/Android 由 API 隱藏價格（priceTwd 為 null），只顯示「學員專屬」。 */
export function CoursePriceTag({ course }: { course: CourseSummary }) {
  if (course.enrollment === "opened") return <Pill label="已開通" tone="success" />;
  if (course.enrollment === "pending") return <Pill label="待審核" tone="warning" />;
  if (course.priceTba) return <Pill label="費用尚未公布" tone="warning" />;
  if (course.hasRuns && course.enrollment === null) return <Pill label="分場次報名" tone="accent" />;
  if (course.freeNow) return <Pill label="限時免費" tone="accent" />;
  if (course.free) return <Pill label="免費" tone="accent" />;
  if (course.priceTwd !== null) return <Pill label={`NT$${course.priceTwd.toLocaleString()}`} />;
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
  coverWrap: { borderRadius: radius.md, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  date: { textAlign: "right", flexShrink: 0, paddingTop: 2 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  bar: { height: 6, borderRadius: radius.pill },
});
