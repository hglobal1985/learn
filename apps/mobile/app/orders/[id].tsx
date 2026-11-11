import { router, useLocalSearchParams } from "expo-router";
import type { Order } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { WebOnly } from "@/features/web-only";
import { useApi } from "@/state/session";
import { Button, ErrorView, LoadingView, NoticeBox, Screen } from "@/ui";

function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Order>(`/orders/${id}`);
  if (!data) return <Screen header={false}>{loading ? <LoadingView /> : <ErrorView message={error ?? "找不到訂單"} onRetry={reload} />}</Screen>;
  return (
    <Screen header={false}>
      {data.status === "pending" ? (
        <NoticeBox
          tone="warning"
          text={`訂單已送出，等待管理員確認收款。付款時請備註訂單編號 ${data.id}；客服信箱 service@hglobal1985.com。（內部測試期間不需實際付款）`}
        />
      ) : null}
      {data.status === "opened" ? <NoticeBox tone="success" text="課程已開通，可以開始上課了。" /> : null}
      <OrderCard order={data} />
      {data.status === "opened" ? <Button label="前往我的課程" onPress={() => router.navigate("/learning")} fullWidth /> : null}
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
