import type { CourseSummary, Member, SortGroup } from "@/api/client";
import { todayStr } from "@/ui/date-select";
import { classify } from "./ribbons";

/** 課程排序用的日期：活動日期；沒有就用最近一場的開課日（台灣時間的日期）。 */
export const startOf = (c: CourseSummary): string | null => c.eventStart ?? (c.nextRunAt ? new Date(Date.parse(c.nextRunAt) + 8 * 3600_000).toISOString().slice(0, 10) : null);

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
