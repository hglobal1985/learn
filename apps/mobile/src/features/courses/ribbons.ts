import type { CourseSummary, Member, RibbonColor, RibbonKey, SortGroup, UiConfig } from "@/api/client";
import { todayStr } from "@/ui/date-select";
import { startOf } from "./sort";

/**
 * 緞帶色表：只能用《寰宇生態系固定配色規範》的色（色碼出自 docs/hglobal-tokens.json）。
 * fg＝緞帶上文字的顏色（黃、鮭粉底用深色字，其餘白字）。
 */
export const RIBBON_COLORS: Record<RibbonColor, { name: string; bg: string; fg: string }> = {
  green: { name: "主綠", bg: "#0c603c", fg: "#ffffff" },
  greenDark: { name: "深綠", bg: "#094a2e", fg: "#ffffff" },
  olive: { name: "橄欖綠", bg: "#486c48", fg: "#ffffff" },
  orange: { name: "橘", bg: "#cc6c0c", fg: "#ffffff" },
  warn: { name: "警示橘褐", bg: "#a86408", fg: "#ffffff" },
  yellow: { name: "黃", bg: "#f2dc27", fg: "#1d2a22" },
  salmon: { name: "鮭粉", bg: "#f0a884", fg: "#1d2a22" },
  danger: { name: "危險紅", bg: "#b3261e", fg: "#ffffff" },
  ok: { name: "成功綠", bg: "#1b7a43", fg: "#ffffff" },
  muted: { name: "灰（次要文字色）", bg: "#5d6b62", fg: "#ffffff" },
};

export type RibbonSpec = { key: RibbonKey; label: string; bg: string; fg: string };
const spec = (cfg: UiConfig, key: RibbonKey, n?: number): RibbonSpec | null => {
  const r = cfg.ribbons[key];
  if (!r?.enabled) return null;
  const c = RIBBON_COLORS[r.color] ?? RIBBON_COLORS.green;
  return { key, label: r.label.replace("{n}", String(n ?? "")), bg: c.bg, fg: c.fg };
};

/** 距離活動開始還有幾天（只有「尚未開始」才有值）。 */
export function daysUntil(c: CourseSummary): number | null {
  const start = startOf(c);
  if (!start) return null;
  const today = todayStr();
  if (start <= today) return null;
  return Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
/** 活動日期狀態：upcoming＝還沒開始、running＝進行中、ended＝已結束、none＝沒有日期。 */
export function dateState(c: CourseSummary): "upcoming" | "running" | "ended" | "none" {
  const start = startOf(c);
  if (!start) return "none";
  const today = todayStr();
  if (start > today) return "upcoming";
  return (c.eventEnd ?? start) >= today ? "running" : "ended";
}

/** 左上角（資格或狀態）與右上角（日期倒數）要顯示的緞帶。顏色與文字由設定決定。 */
export function ribbonsFor(course: CourseSummary, member: Member | null, cfg: UiConfig): { left: RibbonSpec | null; right: RibbonSpec | null } {
  const completed = course.lessonCount > 0 && course.completedLessons >= course.lessonCount;
  let left: RibbonSpec | null = null;
  if (!member) left = course.isPublic ? spec(cfg, "public_free") : null;
  else if (course.enrollment === "opened") left = spec(cfg, completed ? "completed" : "learning");
  else if (course.enrollment === "pending") left = spec(cfg, "pending");
  else if (!course.eligible) left = spec(cfg, "ineligible");
  else if (course.isPublic) left = null; // 公開免費的課程不用報名
  else if (course.priceTba) left = spec(cfg, "price_tba");
  else if (!course.registrationOpen) left = spec(cfg, "closed");
  else left = spec(cfg, "can_register");
  const ds = dateState(course);
  const n = daysUntil(course);
  const right = ds === "upcoming" && n != null ? spec(cfg, "countdown", n) : ds === "running" ? spec(cfg, "in_progress") : ds === "ended" ? spec(cfg, "ended") : null;
  return { left, right };
}

/** 這門課在「全部課程」屬於哪一個排序分組。 */
export function classify(course: CourseSummary, member: Member | null): SortGroup {
  if (course.enrollment === "pending") return "pending";
  if (course.enrollment === "opened") return "enrolled";
  if (course.isPublic) return "public_free";
  const upcoming = dateState(course) === "upcoming";
  if (member && !course.eligible) return upcoming ? "ineligible_upcoming" : "ineligible_started";
  return upcoming ? "eligible_upcoming" : "eligible_started";
}
