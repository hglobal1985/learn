import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { cleanUnit } from "@/features/format";
import { SeriesTile } from "@/features/courses/series-tile";
import { groupBySeries, sortCourses } from "@/features/courses/sort";
import { useApi, useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { space } from "@/theme/tokens";
import { EmptyState, ErrorView, LoadingView, Screen, Select } from "@/ui";

const ALL = "";
const GAP = space.md;

export default function CoursesScreen() {
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const [category, setCategory] = useState(ALL);
  const [unit, setUnit] = useState(ALL);
  const [boxW, setBoxW] = useState(0);
  const { member } = useSession();
  const { config } = useUiConfig();
  const courses = useMemo(() => sortCourses(data ?? [], member, config.sortGroups), [data, member, config.sortGroups]);
  const categories = useMemo(() => [...new Set(courses.flatMap((x) => x.category.split("、")).filter(Boolean))], [courses]);
  const units = useMemo(() => [...new Set(courses.flatMap((x) => x.hostUnit.split("、")).filter(Boolean))], [courses]);
  const list = courses.filter((x) => (category === ALL || x.category.split("、").includes(category)) && (unit === ALL || x.hostUnit.split("、").includes(unit)));
  const groups = useMemo(() => groupBySeries(list, courses), [list, courses]);
  // 一排放幾張：手機 2 張，寬一點的畫面 3 張，同一頁容納更多。
  const cols = boxW >= 520 ? 3 : 2;
  const tileW = boxW ? Math.floor((boxW - GAP * (cols - 1)) / cols) : 0;
  return (
    <Screen title="全部課程" subtitle={data ? `共 ${groups.length} 個課程系列` : undefined}>
      <View style={styles.filters}>
        <Select label="分類" value={category} options={[{ key: ALL, label: "全部分類" }, ...categories.map((x) => ({ key: x, label: x }))]} onChange={setCategory} />
        {units.length ? <Select label="主辦單位" value={unit} options={[{ key: ALL, label: "全部單位" }, ...units.map((u) => ({ key: u, label: cleanUnit(u) }))]} onChange={setUnit} /> : null}
      </View>
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data && !groups.length ? <EmptyState icon="library-outline" title="沒有符合條件的課程" /> : null}
      <View style={styles.grid} onLayout={(e) => setBoxW(Math.floor(e.nativeEvent.layout.width))}>
        {tileW ? groups.map((g) => <SeriesTile key={g.key} group={g} width={tileW} />) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ filters: { flexDirection: "row", gap: space.sm }, grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, rowGap: space.lg } });
