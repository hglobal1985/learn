import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { api, type Order } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { OrderTimeline } from "@/features/orders/timeline";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { Button, ErrorView, LoadingView, NoticeBox, Screen } from "@/ui";

function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invalidate } = useSession();
  const { data, error, loading, reload } = useApi<Order>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return <Screen header={false}>{loading ? <LoadingView /> : <ErrorView message={error ?? "找不到這筆報名"} onRetry={reload} />}</Screen>;
  const cancel = async () => {
    if (!window.confirm("確定要取消這筆報名嗎？\n\n取消後可以重新報名。")) return;
    setBusy(true);
    setErr(null);
    try {
      await api("POST", `/orders/${id}/cancel`);
      invalidate();
      router.replace("/orders");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const collectors = data.collectors?.length ? `你所屬中心的收費窗口：${data.collectors.join("、")}。` : "";
  return (
    <Screen header={false}>
      {data.status === "pending" ? (
        <NoticeBox
          tone="warning"
          text={`${data.deferred ? "這筆報名延後審核，請依原因處理。" : "報名已送出，等待審核。"}請以現金或轉帳向報名窗口繳費，並告知報名編號 ${data.id}。${collectors}窗口確認後課程就會開通。`}
        />
      ) : null}
      {data.status === "opened" ? <NoticeBox tone="success" text="課程已開通，可以開始上課了。" /> : null}
      {data.status === "rejected" ? <NoticeBox tone="danger" text={data.revoked ? "這筆報名的開通已被撤銷。" : "這筆報名已退回，處理後可以到課程頁重新報名。"} /> : null}
      {err ? <NoticeBox tone="danger" text={err} /> : null}
      <OrderCard order={data} />
      {data.status === "pending" ? <Button variant="danger" label="取消報名" icon="close-circle-outline" loading={busy} disabled={busy} onPress={cancel} fullWidth /> : null}
      {data.status === "opened" ? <Button label="前往學習中的課程" onPress={() => router.navigate("/learning")} fullWidth /> : null}
      {data.status === "rejected" && !data.revoked ? <Button label="回到課程頁重新報名" onPress={() => router.push(`/course/${data.items[0]?.courseId}`)} fullWidth /> : null}
      <OrderTimeline order={data} />
    </Screen>
  );
}

export default function OrderScreen() {
  return (
    <WebOnly>
      <OrderDetail />
    </WebOnly>
  );
}
