import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet } from "react-native";
import type { CourseSummary } from "@/api/client";
import { CourseCard } from "@/features/courses/course-card";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button, EmptyState, ErrorView, LoadingView, Screen } from "@/ui";

const all = "全部";

export default function CoursesScreen() {
  const { c } = useTheme();
  const { cart } = useSession();
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const [category, setCategory] = useState(all);
  const courses = useMemo(() => data ?? [], [data]);
  const categories = useMemo(() => [all, ...new Set(courses.map((x) => x.category))], [courses]);
  const list = category === all ? courses : courses.filter((x) => x.category === category);
  return (
    <Screen
      title="課程"
      subtitle={data ? `共 ${courses.length} 門課程` : undefined}
      right={
        Platform.OS === "web" && cart.length ? (
          <Button variant="secondary" icon="cart-outline" label={`報名清單 ${cart.length}`} onPress={() => router.push("/cart")} />
        ) : undefined
      }
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
