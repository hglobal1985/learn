import type { CourseSummary } from "@/api/client";
import { todayStr } from "@/ui/date-select";

/** 課程排序用的日期：活動日期；沒有就用最近一場的開課日（台灣時間的日期）。 */
export const startOf = (c: CourseSummary): string | null => c.eventStart ?? (c.nextRunAt ? new Date(Date.parse(c.nextRunAt) + 8 * 3600_000).toISOString().slice(0, 10) : null);

/**
 * 「全部課程」預設排序（依課程日期）：
 * 1. 今天或之後的活動，日期近的在前（正在進行的連續活動也算）；
 * 2. 沒有設定日期的課程；
 * 3. 已經結束的活動，最近結束的在前。
 */
export function sortByEventDate(list: CourseSummary[]): CourseSummary[] {
  const today = todayStr();
  const upcoming: CourseSummary[] = [];
  const undated: CourseSummary[] = [];
  const past: CourseSummary[] = [];
  for (const c of list) {
    const start = startOf(c);
    if (!start) undated.push(c);
    else if ((c.eventEnd ?? start) >= today) upcoming.push(c);
    else past.push(c);
  }
  upcoming.sort((a, b) => startOf(a)!.localeCompare(startOf(b)!));
  past.sort((a, b) => startOf(b)!.localeCompare(startOf(a)!));
  return [...upcoming, ...undated, ...past];
}

/** 距離活動開始還有幾天（只有「尚未開始」才有值；今天或已開始、已結束、沒有日期都回傳 null）。 */
export function daysUntilStart(c: CourseSummary): number | null {
  const start = startOf(c);
  if (!start) return null;
  const today = todayStr();
  if (start <= today) return null;
  return Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
