import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Card, CourseCover, Pill } from "@/ui";

export function CourseCard({ course }: { course: CourseSummary }) {
  const { c } = useTheme();
  const ratio = course.lessonCount ? course.completedLessons / course.lessonCount : 0;
  return (
    <Card onPress={() => router.push(`/course/${course.id}`)} accessibilityLabel={`${course.title}，${course.teacher}`}>
      <CourseCover theme={course.theme} label={course.category} imageUrl={course.coverUrl} />
      <AppText variant="headline">{course.title}</AppText>
      <AppText variant="callout" tone="muted" numberOfLines={2}>
        {course.subtitle}
      </AppText>
      <UnitTags course={course} />
      <View style={styles.meta}>
        <CoursePriceTag course={course} />
        {course.minRank.order > 10 ? <Pill label={`${course.minRank.name}以上`} tone={course.eligible ? "neutral" : "warning"} /> : null}
        {course.status !== "published" ? <Pill label="未上架" tone="danger" /> : null}
        <AppText variant="caption" tone="muted">
          {course.lessonCount} 堂 · {course.totalMinutes} 分鐘
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
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  bar: { height: 6, borderRadius: radius.pill },
});
