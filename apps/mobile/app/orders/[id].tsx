import { router, useLocalSearchParams } from "expo-router";
import type { Order } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { OrderTimeline } from "@/features/orders/timeline";
import { WebOnly } from "@/features/web-only";
import { useApi } from "@/state/session";
import { Button, ErrorView, LoadingView, NoticeBox, Screen } from "@/ui";

function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Order>(`/orders/${id}`);
  if (!data) return <Screen header={false}>{loading ? <LoadingView /> : <ErrorView message={error ?? "找不到這筆報名"} onRetry={reload} />}</Screen>;
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
      <OrderCard order={data} />
      {data.status === "opened" ? <Button label="前往已報名課程" onPress={() => router.navigate("/learning")} fullWidth /> : null}
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
