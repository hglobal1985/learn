import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { CourseCard } from "@/features/courses/course-card";
import { useStore } from "@/state/store";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, EmptyState, Screen } from "@/ui";

const all = "全部";

export default function CoursesScreen() {
  const { state } = useStore();
  const { c } = useTheme();
  const [category, setCategory] = useState(all);
  const published = state.courses.filter((x) => x.published);
  const categories = useMemo(() => [all, ...new Set(published.map((x) => x.category))], [published]);
  const list = category === all ? published : published.filter((x) => x.category === category);
  return (
    <Screen title="課程" subtitle={`共 ${published.length} 門課程`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {categories.map((name) => {
          const active = name === category;
          return (
            <Pressable
              key={name}
              onPress={() => setCategory(name)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border },
              ]}
            >
              <AppText variant="callout" style={{ color: active ? c.textOnAccent : c.text, fontWeight: "600" }}>
                {name}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      {list.length ? (
        list.map((course) => <CourseCard key={course.id} course={course} />)
      ) : (
        <EmptyState icon="library-outline" title="這個分類還沒有課程" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm },
  chip: {
    minHeight: minTouch - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
  },
});
