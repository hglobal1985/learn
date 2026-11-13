import type { CourseSummary, Member, SortGroup } from "@/api/client";
import { todayStr } from "@/ui/date-select";
import { classify } from "./ribbons";

/** 課程排序用的日期：活動日期（沒有就是 null）。 */
export const startOf = (c: CourseSummary): string | null => c.eventStart;

/**
 * 「全部課程」排序：先依分組優先順序（由超級管理員在「課程排序與條件」設定），
 * 同一組內：還沒開始的日期由近到遠，已開始或沒有日期的由新到舊。
 */
export function sortCourses(list: CourseSummary[], member: Member | null, groups: SortGroup[]): CourseSummary[] {
  const rank = new Map(groups.map((g, i) => [g, i]));
  const today = todayStr();
  const upcomingKey = (c: CourseSummary) => ((startOf(c) ?? "9999-12-31") > today ? 0 : 1);
  return [...list].sort((a, b) => {
    const ga = rank.get(classify(a, member)) ?? 99;
    const gb = rank.get(classify(b, member)) ?? 99;
    if (ga !== gb) return ga - gb;
    const ua = upcomingKey(a);
    const ub = upcomingKey(b);
    if (ua !== ub) return ua - ub;
    const sa = startOf(a) ?? "";
    const sb = startOf(b) ?? "";
    return ua === 0 ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}

export type SeriesEntry = { course: CourseSummary; siblings: CourseSummary[] };

/** 代表卡的挑選分數（越小越優先）：審核中 > 已開通 > 還沒開始且日期最近 > 已結束且最近結束。 */
function repScore(c: CourseSummary, today: string): number {
  if (c.enrollment === "pending") return 0;
  if (c.enrollment === "opened") return 1;
  const d = startOf(c) ?? "9999-12-31";
  const days = Math.abs(Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return d >= today ? 2 + days / 100000 : 3 + days / 100000;
}

/**
 * 同系列的課只留一張代表卡（沒有填系列的課不合併），順序依代表卡在原清單的位置。
 * siblings＝同系列的其他梯次（從 all 找，不受分類或單位篩選影響）。
 */
export function collapseSeries(list: CourseSummary[], all: CourseSummary[]): SeriesEntry[] {
  const today = todayStr();
  const best = new Map<string, CourseSummary>();
  for (const c of list) {
    if (!c.series) continue;
    const cur = best.get(c.series);
    if (!cur || repScore(c, today) < repScore(cur, today)) best.set(c.series, c);
  }
  return list
    .filter((c) => !c.series || best.get(c.series) === c)
    .map((c) => ({ course: c, siblings: c.series ? all.filter((x) => x.series === c.series && x.id !== c.id).sort((a, b) => (startOf(b) ?? "").localeCompare(startOf(a) ?? "")) : [] }));
}

/** 課程在卡片、封面、首頁上顯示的名稱：有系列就顯示系列名稱，沒有系列才顯示課程名稱。 */
export const displayName = (c: { series: string; title: string }): string => c.series || c.title;
