import { useLocalSearchParams } from "expo-router";
import { CoursesView } from "@/features/courses/courses-view";
import { PageHeader } from "@/features/page-header";

/** 系列單頁（沒有設定短網址時的網址 /series/系列名稱）：該系列全部梯次展開；上方工具列與課程頁相同（標題＋分享）。 */
export default function SeriesPage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const series = decodeURIComponent(String(name ?? ""));
  return (
    <>
      <PageHeader title={series} path={`/series/${encodeURIComponent(series)}`} />
      <CoursesView series={series} />
    </>
  );
}
