import { Platform } from "react-native";
import type { OrderStatus } from "@/api/client";

export const ntd = (n: number) => `NT$${n.toLocaleString()}`;

/** 日期顯示一律不補 0：2026/11/8 7:30（分鐘仍保留兩位數，7:03 不能寫成 7:3）。 */
export function dateTime(isoText: string): string {
  const d = new Date(isoText);
  return `${dateOnly(isoText)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 只顯示日期：2026/11/8（不補 0）。 */
export function dateOnly(isoText: string): string {
  const d = new Date(isoText);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 「2026-11-08」→「2026/11/8」（不補 0）。 */
export function plainDate(ymd: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(ymd);
  return m ? `${Number(m[1])}/${Number(m[2])}/${Number(m[3])}` : ymd;
}

type Tone = "warning" | "success" | "danger" | "neutral";
export function orderStatus(o: { status: OrderStatus; deferred?: boolean; revoked?: boolean }): { label: string; tone: Tone } {
  if (o.revoked) return { label: "已撤銷", tone: "danger" };
  if (o.status === "opened") return { label: "已開通", tone: "success" };
  if (o.status === "rejected") return { label: "已退回", tone: "danger" };
  return o.deferred ? { label: "延後再審", tone: "neutral" } : { label: "待審核", tone: "warning" };
}
export const payMethodLabel: Record<string, string> = { cash: "現金", transfer: "轉帳", vip: "VIP 免繳費", online: "線上", free: "免費" };
export const eventLabel: Record<string, string> = { submit: "送出報名", paid: "確認已繳費，開通", vip: "VIP 免繳費，開通", reject: "退回", defer: "延後再審", revoke: "撤銷開通", message: "留言", note: "私人備註" };

/** 通知連結在 App 上若指向 Web 限定頁面（報名、審核），改帶到我的課程。 */
export function noticeTarget(link: string): string {
  if (Platform.OS !== "web" && (link.startsWith("/orders") || link.startsWith("/admin/orders"))) return "/learning";
  return link;
}

/** 日期時間輸入：「2026-12-01 19:30」⇄ ISO。空白回傳 null；格式錯誤回傳 undefined。 */
export function parseLocal(textValue: string): string | null | undefined {
  const t = textValue.trim();
  if (!t) return null;
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(t);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
export function toLocal(isoText: string | null | undefined): string {
  if (!isoText) return "";
  const d = new Date(isoText);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 活動日期顯示（不補 0）：單日「2026/11/20」，連續多天「2026/11/20～11/22」。 */
export function eventDays(start: string | null | undefined, end?: string | null): string {
  if (!start) return "";
  if (!end || end === start) return plainDate(start);
  return `${plainDate(start)}～${plainDate(end).split("/").slice(1).join("/")}`;
}

/** 單位名稱不顯示教育中心的數字代碼：「飛登 013」→「飛登」。 */
export const cleanUnit = (u: string): string => u.replace(/\s*\d+\s*$/, "").trim();

/** 指導與主辦的顯示格式：「寰宇總部指導、台中主辦」（多個主辦用「、」連起來；沒有的就略過）。 */
export function unitLine(c: { guidanceUnit: string; hostUnit: string }): string {
  const hosts = c.hostUnit.split(/[、,，;；\n]+/).map(cleanUnit).filter(Boolean);
  return [c.guidanceUnit ? `${cleanUnit(c.guidanceUnit)}指導` : "", hosts.length ? `${hosts.join("、")}主辦` : ""].filter(Boolean).join("、");
}

/** 只有主辦單位的顯示：「台中主辦」（首頁區塊用，不含指導單位）。 */
export function hostLine(c: { hostUnit: string }): string {
  const hosts = c.hostUnit.split(/[、,，;；\n]+/).map(cleanUnit).filter(Boolean);
  return hosts.length ? `${hosts.join("、")}主辦` : "";
}
