import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { CourseCard } from "./course-card";
import { byNearest } from "./series-sheet";
import { SeriesTile } from "./series-tile";
import { groupBySeries, sortCourses } from "./sort";
import { useApi, useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { canManageCourses } from "@/lib/roles";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { EmptyState, ErrorView, LoadingView, Screen, Select } from "@/ui";

const ALL = "";
const GAP = space.md;

/** 全部課程清單。initialCategory／series 由網址（短網址 /c、/s 或 ?category=、?series=）帶入；series 篩選時上方有可清除的標籤。 */
export function CoursesView({ initialCategory = "", series = "", inStack = false }: { initialCategory?: string; series?: string; inStack?: boolean }) {
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const [category, setCategory] = useState(initialCategory || ALL);
  const seriesFilter = series;
  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);
  // 網頁：選分類時，網址列同步成該分類的短網址（有設定縮寫才換；其餘維持 /courses），方便直接複製分享。
  const links = useApi<{ kind: string; value: string; slug: string }[]>("/short-links");
  const pickCategory = (v: string) => {
    setCategory(v);
    if (Platform.OS !== "web" || typeof window === "undefined" || seriesFilter) return;
    const slug = v === ALL ? null : links.data?.find((l) => l.kind === "category" && l.value === v)?.slug;
    window.history.replaceState(window.history.state, "", slug ? `/${slug}` : "/courses");
  };
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
  // 系列單頁（顯示全部）時，分類下拉顯示這個系列所屬的分類（有多個分類就顯示「全部分類」）；改選別的分類就離開系列頁。
  const seriesCats = seriesFilter ? [...new Set(courses.filter((x) => x.series === seriesFilter).flatMap((x) => x.category.split("、")).filter(Boolean))] : [];
  const shownCategory = seriesFilter ? (seriesCats.length === 1 ? seriesCats[0]! : ALL) : category;
  const leaveSeries = (v: string) => {
    const slug = v === ALL ? null : links.data?.find((l) => l.kind === "category" && l.value === v)?.slug;
    if (slug) router.replace(`/${slug}`);
    else router.replace(v === ALL ? "/courses" : { pathname: "/courses", params: { category: v } });
  };
  const filterRow = (
    <View style={styles.filters}>
      <Select label="分類" value={shownCategory} options={[{ key: ALL, label: "全部分類" }, ...categories.map((x) => ({ key: x, label: x }))]} onChange={seriesFilter ? leaveSeries : pickCategory} />
      {canManageCourses(member) ? (
        <Pressable accessibilityRole="button" accessibilityLabel="課程設定" onPress={() => router.push("/admin/courses")} hitSlop={8} style={styles.gear}>
          <Ionicons name="settings-outline" size={26} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );
  // 系列單頁：只列該系列，每一梯都展開成完整課程卡，由近到遠。
  if (seriesFilter) {
    const all = byNearest(courses.filter((x) => x.series === seriesFilter));
    return (
      <Screen header={!inStack}>
        {filterRow}
        {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingView /> : null}
        {data && !all.length ? <EmptyState icon="library-outline" title="這個系列目前沒有課程" /> : null}
        {all.map((x) => (
          <CourseCard key={x.id} course={x} />
        ))}
      </Screen>
    );
  }
  return (
    <Screen header={!inStack}>
      {filterRow}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data && !groups.length ? <EmptyState icon="library-outline" title="沒有符合條件的課程" /> : null}
      <View style={styles.grid} onLayout={(e) => setBoxW(Math.floor(e.nativeEvent.layout.width))}>
        {tileW ? groups.map((g) => <SeriesTile key={g.key} group={g} width={tileW} />) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ filters: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  gear: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, rowGap: space.lg } });
