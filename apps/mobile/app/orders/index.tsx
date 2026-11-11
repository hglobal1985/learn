import { router } from "expo-router";
import type { Order } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { WebOnly } from "@/features/web-only";
import { useApi } from "@/state/session";
import { EmptyState, ErrorView, LoadingView, Screen } from "@/ui";

function Orders() {
  const { data, error, loading, reload } = useApi<Order[]>("/orders");
  return (
    <Screen header={false}>
      {loading && !data ? <LoadingView /> : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {data && !data.length ? <EmptyState icon="receipt-outline" title="還沒有訂單" /> : null}
      {data?.map((o) => <OrderCard key={o.id} order={o} onPress={() => router.push(`/orders/${o.id}`)} />)}
    </Screen>
  );
}

export default function OrdersScreen() {
  return (
    <WebOnly>
      <Orders />
    </WebOnly>
  );
}
