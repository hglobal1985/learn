import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { SeriesTile } from "@/features/courses/series-tile";
import { groupBySeries, sortCourses } from "@/features/courses/sort";
import { useApi, useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { canManageCourses } from "@/lib/roles";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { AppText, EmptyState, ErrorView, LoadingView, Screen, Select } from "@/ui";

const ALL = "";
const GAP = space.md;

export default function CoursesScreen() {
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const params = useLocalSearchParams<{ category?: string; series?: string }>();
  const [category, setCategory] = useState(ALL);
  const seriesFilter = typeof params.series === "string" ? params.series : "";
  // 短網址（/c/縮寫）帶來的分類：套用成篩選。
  useEffect(() => {
    if (typeof params.category === "string" && params.category) setCategory(params.category);
  }, [params.category]);
  const [boxW, setBoxW] = useState(0);
  const { member } = useSession();
  const { c } = useTheme();
  const { config } = useUiConfig();
  const courses = useMemo(() => sortCourses(data ?? [], member, config.sortGroups), [data, member, config.sortGroups]);
  const categories = useMemo(() => [...new Set(courses.flatMap((x) => x.category.split("、")).filter(Boolean))], [courses]);
  const list = courses.filter((x) => (category === ALL || x.category.split("、").includes(category)) && (!seriesFilter || x.series === seriesFilter));
  const groups = useMemo(() => groupBySeries(list, courses), [list, courses]);
  // 一排放幾張：手機 2 張，寬一點的畫面 3 張，同一頁容納更多。
  const cols = boxW >= 520 ? 3 : 2;
  const tileW = boxW ? Math.floor((boxW - GAP * (cols - 1)) / cols) : 0;
  return (
    <Screen>
      <View style={styles.filters}>
        <Select label="分類" value={category} options={[{ key: ALL, label: "全部分類" }, ...categories.map((x) => ({ key: x, label: x }))]} onChange={setCategory} />
        {canManageCourses(member) ? (
          <Pressable accessibilityRole="button" accessibilityLabel="課程設定" onPress={() => router.push("/admin/courses")} hitSlop={8} style={styles.gear}>
            <Ionicons name="settings-outline" size={26} color={c.text} />
          </Pressable>
        ) : null}
      </View>
      {seriesFilter ? (
        <Pressable accessibilityRole="button" accessibilityLabel="清除系列篩選，看全部課程" onPress={() => router.replace("/courses")} style={[styles.seriesChip, { backgroundColor: c.accentSoft }]}>
          <AppText variant="callout" style={{ color: c.accentText, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>
            系列：{seriesFilter}
          </AppText>
          <Ionicons name="close-circle" size={22} color={c.accentText} />
        </Pressable>
      ) : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data && !groups.length ? <EmptyState icon="library-outline" title="沒有符合條件的課程" /> : null}
      <View style={styles.grid} onLayout={(e) => setBoxW(Math.floor(e.nativeEvent.layout.width))}>
        {tileW ? groups.map((g) => <SeriesTile key={g.key} group={g} width={tileW} />) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ seriesChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: space.xs, minHeight: 44, paddingHorizontal: space.md, borderRadius: 22, maxWidth: "100%" }, filters: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  gear: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, rowGap: space.lg } });
