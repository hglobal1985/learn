import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import type { CourseSummary } from "@/api/client";
import { CourseCard } from "@/features/courses/course-card";
import { useApi } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Chips, EmptyState, ErrorView, LoadingView, Screen } from "@/ui";

const all = "全部";

export default function CoursesScreen() {
  const { c } = useTheme();
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const [category, setCategory] = useState(all);
  const [unit, setUnit] = useState(all);
  const courses = useMemo(() => data ?? [], [data]);
  const categories = useMemo(() => [all, ...new Set(courses.map((x) => x.category))], [courses]);
  const units = useMemo(() => [...new Set(courses.flatMap((x) => [x.guidanceUnit, x.hostUnit]).filter(Boolean))], [courses]);
  const list = courses.filter((x) => (category === all || x.category === category) && (unit === all || x.guidanceUnit === unit || x.hostUnit === unit));
  return (
    <Screen
      title="課程"
      subtitle={data ? `共 ${courses.length} 門課程` : undefined}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {categories.map((name) => {
          const active = name === category;
          return (
            <Pressable
              key={name}
              onPress={() => setCategory(name)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
            >
              <AppText variant="callout" style={{ color: active ? c.textOnAccent : c.text, fontWeight: "600" }}>
                {name}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      {units.length ? <Chips label="指導或主辦單位" options={[{ key: all, label: "全部單位" }, ...units.map((u) => ({ key: u, label: u }))]} value={unit} onChange={setUnit} /> : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data && !list.length ? <EmptyState icon="library-outline" title="這個分類還沒有課程" /> : null}
      {list.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
});
