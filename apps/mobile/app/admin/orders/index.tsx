import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { download, type CourseSummary, type Order } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Chips, EmptyState, ErrorView, Field, LoadingView, NoticeBox, Screen } from "@/ui";

type Status = "pending" | "deferred" | "opened" | "rejected" | "all";
const statuses: { key: Status; label: string }[] = [
  { key: "pending", label: "待審核" },
  { key: "deferred", label: "延後再審" },
  { key: "opened", label: "已開通" },
  { key: "rejected", label: "已退回" },
  { key: "all", label: "全部" },
];

/** 報名審核清單：只列出自己有權限的報名；可依狀態、課程、中心、姓名篩選並匯出對帳報表。 */
function ReviewList() {
  const { member } = useSession();
  const [status, setStatus] = useState<Status>("pending");
  const [courseId, setCourseId] = useState("all");
  const [center, setCenter] = useState("all");
  const [q, setQ] = useState("");
  const [outsiders, setOutsiders] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (courseId !== "all") query.set("courseId", courseId);
  if (center !== "all") query.set("center", center);
  if (q.trim()) query.set("q", q.trim());
  if (outsiders) query.set("hglobal", "0");
  const qs = query.toString();
  const allowed = !!member?.reviewer;
  const orders = useApi<Order[]>(allowed ? `/admin/orders${qs ? `?${qs}` : ""}` : null);
  const courses = useApi<CourseSummary[]>(allowed ? "/courses" : null);
  const centers = useApi<string[]>(allowed && member?.role === "admin" ? "/centers" : null);
  if (!allowed) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要審核權限" /></Screen>;

  const exportCsv = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await download(`/admin/orders.csv${qs ? `?${qs}` : ""}`, `報名對帳-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const paidCourses = (courses.data ?? []).filter((c) => !c.free || (c.originalPriceTwd ?? 0) > 0);

  return (
    <Screen header={false}>
      <Chips label="狀態" options={statuses} value={status} onChange={setStatus} />
      <AppText variant="callout" tone="muted">
        課程
      </AppText>
      <Chips label="課程" options={[{ key: "all", label: "全部課程" }, ...paidCourses.map((c) => ({ key: c.id, label: c.title }))]} value={courseId} onChange={setCourseId} />
      {centers.data?.length ? (
        <>
          <AppText variant="callout" tone="muted">
            中心
          </AppText>
          <Chips label="中心" options={[{ key: "all", label: "全部中心" }, ...centers.data.map((c) => ({ key: c, label: c }))]} value={center} onChange={setCenter} />
        </>
      ) : null}
      <Field label="搜尋姓名或報名編號" value={q} onChange={setQ} />
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
        {member?.role === "admin" ? <Button variant={outsiders ? "primary" : "secondary"} label="只看非寰宇系統" onPress={() => setOutsiders(!outsiders)} /> : null}
        <Button variant="secondary" label="匯出對帳報表（CSV）" icon="download-outline" loading={busy} onPress={exportCsv} />
      </View>
      {msg ? <NoticeBox tone="danger" text={msg} /> : null}
      {orders.data ? (
        <AppText variant="callout" tone="muted">
          共 {orders.data.length} 筆{orders.data.length >= 300 ? "（只顯示最新 300 筆，完整資料請匯出報表）" : ""}
        </AppText>
      ) : null}
      {orders.loading && !orders.data ? <LoadingView /> : null}
      {orders.error && !orders.data ? <ErrorView message={orders.error} onRetry={orders.reload} /> : null}
      {orders.data && !orders.data.length ? <EmptyState icon="checkmark-done-outline" title="沒有符合的報名" /> : null}
      {orders.data?.map((o) => <OrderCard key={o.id} order={o} showMember onPress={() => router.push(`/admin/orders/${o.id}`)} />)}
    </Screen>
  );
}

export default function AdminOrdersScreen() {
  return (
    <WebOnly>
      <ReviewList />
    </WebOnly>
  );
}
