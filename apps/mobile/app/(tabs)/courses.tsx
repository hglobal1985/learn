import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { CourseCard } from "@/features/courses/course-card";
import { sortByEventDate } from "@/features/courses/sort";
import { useApi } from "@/state/session";
import { space } from "@/theme/tokens";
import { EmptyState, ErrorView, LoadingView, Screen, Select } from "@/ui";

const ALL = "";

export default function CoursesScreen() {
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const [category, setCategory] = useState(ALL);
  const [unit, setUnit] = useState(ALL);
  const courses = useMemo(() => sortByEventDate(data ?? []), [data]);
  const categories = useMemo(() => [...new Set(courses.map((x) => x.category).filter(Boolean))], [courses]);
  const units = useMemo(() => [...new Set(courses.flatMap((x) => [x.guidanceUnit, x.hostUnit]).filter(Boolean))], [courses]);
  const list = courses.filter((x) => (category === ALL || x.category === category) && (unit === ALL || x.guidanceUnit === unit || x.hostUnit === unit));
  return (
    <Screen title="全部課程" subtitle={data ? `共 ${list.length} 門課程（依課程日期排序）` : undefined}>
      <View style={styles.filters}>
        <Select label="分類" value={category} options={[{ key: ALL, label: "全部分類" }, ...categories.map((x) => ({ key: x, label: x }))]} onChange={setCategory} />
        {units.length ? <Select label="指導或主辦單位" value={unit} options={[{ key: ALL, label: "全部單位" }, ...units.map((u) => ({ key: u, label: u }))]} onChange={setUnit} /> : null}
      </View>
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data && !list.length ? <EmptyState icon="library-outline" title="沒有符合條件的課程" /> : null}
      {list.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ filters: { flexDirection: "row", gap: space.sm } });
