import { Platform } from "react-native";
import type { OrderStatus } from "@/api/client";

export const ntd = (n: number) => `NT$${n.toLocaleString()}`;

export function dateTime(isoText: string): string {
  const d = new Date(isoText);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const orderStatusLabel: Record<OrderStatus, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "待審核", tone: "warning" },
  opened: { label: "已開通", tone: "success" },
  rejected: { label: "未通過", tone: "danger" },
};

/** 通知連結在 App 上若指向 Web 限定頁面（訂單、審核），改帶到我的課程。 */
export function noticeTarget(link: string): string {
  if (Platform.OS !== "web" && (link.startsWith("/orders") || link.startsWith("/admin/orders"))) return "/learning";
  return link;
}
