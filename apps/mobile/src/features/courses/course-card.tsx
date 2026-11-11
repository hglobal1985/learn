import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { eligible, owned, type Course } from "@/domain/domain";
import { paidCommerceEnabled } from "@/platform/commerce";
import { useStore } from "@/state/store";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Card, CourseCover, Pill } from "@/ui";
import { progressOf, totalMinutes } from "./progress";

export function CourseCard({ course }: { course: Course }) {
  const { state } = useStore();
  const { c } = useTheme();
  const isOwned = owned(state, course.id);
  const progress = progressOf(state, course);
  return (
    <Card onPress={() => router.push(`/course/${course.id}`)} accessibilityLabel={`${course.title}，${course.teacher}`}>
      <CourseCover theme={course.theme} label={course.category} />
      <AppText variant="headline">{course.title}</AppText>
      <AppText variant="callout" tone="muted" numberOfLines={2}>
        {course.subtitle}
      </AppText>
      <View style={styles.meta}>
        <CoursePriceTag course={course} owned={isOwned} />
        {course.rank !== "不限獎銜" ? (
          <Pill label={`${course.rank}以上`} tone={eligible(state.member, course) ? "neutral" : "warning"} />
        ) : null}
        <AppText variant="caption" tone="muted">
          {course.lessons.length} 堂 · {totalMinutes(course)} 分鐘
        </AppText>
      </View>
      {isOwned ? (
        <View style={[styles.track, { backgroundColor: c.surfaceMuted }]} accessibilityLabel={`已完成 ${progress.done}/${progress.total}`}>
          <View style={[styles.bar, { backgroundColor: c.accent, width: `${progress.ratio * 100}%` }]} />
        </View>
      ) : null}
    </Card>
  );
}

/** 價格標籤：iOS/Android 不顯示價格（商店規範），付費課只在 Web 標價。 */
export function CoursePriceTag({ course, owned: isOwned }: { course: Course; owned: boolean }) {
  if (isOwned) return <Pill label="已開通" tone="success" />;
  if (course.price === 0) return <Pill label="免費" tone="accent" />;
  if (paidCommerceEnabled) return <Pill label={`NT$${course.price.toLocaleString()}`} tone="neutral" />;
  return <Pill label="學員專屬" tone="neutral" />;
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  bar: { height: 6, borderRadius: radius.pill },
});
