import { Platform } from "react-native";
import type { OrderStatus } from "@/api/client";

export const ntd = (n: number) => `NT$${n.toLocaleString()}`;

export function dateTime(isoText: string): string {
  const d = new Date(isoText);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

/** 活動日期顯示：單日「2026-11-20」，連續多天「2026-11-20～11-22」。 */
export function eventDays(start: string | null | undefined, end?: string | null): string {
  if (!start) return "";
  return end && end !== start ? `${start}～${end.slice(5)}` : start;
}
