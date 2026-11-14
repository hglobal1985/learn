import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { SeriesTile } from "./series-tile";
import { groupBySeries, sortCourses } from "./sort";
import { useApi, useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { canManageCourses } from "@/lib/roles";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { AppText, EmptyState, ErrorView, LoadingView, Screen, Select } from "@/ui";

const ALL = "";
const GAP = space.md;

/** 全部課程清單。initialCategory／series 由網址（短網址 /c、/s 或 ?category=、?series=）帶入；series 篩選時上方有可清除的標籤。 */
export function CoursesView({ initialCategory = "", series = "" }: { initialCategory?: string; series?: string }) {
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
  return (
    <Screen>
      <View style={styles.filters}>
        <Select label="分類" value={category} options={[{ key: ALL, label: "全部分類" }, ...categories.map((x) => ({ key: x, label: x }))]} onChange={pickCategory} />
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
