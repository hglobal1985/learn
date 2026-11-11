import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { owned } from "@/domain/domain";
import { CoursePriceTag } from "@/features/courses/course-card";
import { totalMinutes } from "@/features/courses/progress";
import { useStore } from "@/state/store";
import { space } from "@/theme/tokens";
import { AppText, Card, CourseCover, EmptyState, ListRow, Pill, Screen, Section } from "@/ui";

/** 課程詳情（第 1 步只有內容展示；領課、結帳、播放在第 2 步加入）。 */
export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const course = state.courses.find((c) => c.id === id && c.published);
  if (!course)
    return (
      <Screen header={false}>
        <EmptyState icon="alert-circle-outline" title="找不到這門課程" body="課程可能已下架。" />
      </Screen>
    );
  const done = new Set(state.completed[course.id] ?? []);
  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: course.title }} />
      <CourseCover theme={course.theme} label={course.category} height={160} />
      <View style={{ gap: space.sm }}>
        <AppText variant="display">{course.title}</AppText>
        <AppText tone="muted">{course.subtitle}</AppText>
        <View style={styles.row}>
          <CoursePriceTag course={course} owned={owned(state, course.id)} />
          {course.rank !== "不限獎銜" ? <Pill label={`限 ${course.rank} 以上`} tone="warning" /> : null}
        </View>
        <AppText variant="callout" tone="muted">
          講師：{course.teacher} · {course.lessons.length} 堂 · 約 {totalMinutes(course)} 分鐘
        </AppText>
      </View>
      <Section title="課程章節">
        <Card style={{ paddingVertical: 0 }}>
          {course.lessons.map((lesson, i) => (
            <ListRow
              key={lesson.id}
              icon={done.has(lesson.id) ? "checkmark-circle" : "play-circle-outline"}
              title={`${i + 1}. ${lesson.title}`}
              subtitle={`${lesson.minutes} 分鐘`}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm } });
