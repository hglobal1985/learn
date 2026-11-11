import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { Order, OrderStatus } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, EmptyState, ErrorView, LoadingView, Screen } from "@/ui";

const filters: { key: OrderStatus | "all"; label: string }[] = [
  { key: "pending", label: "待審核" },
  { key: "opened", label: "已開通" },
  { key: "rejected", label: "未通過" },
  { key: "all", label: "全部" },
];

function AdminOrders() {
  const { c } = useTheme();
  const { member } = useSession();
  const [filter, setFilter] = useState<OrderStatus | "all">("pending");
  const { data, error, loading, reload } = useApi<Order[]>(member?.role === "admin" ? `/admin/orders${filter === "all" ? "" : `?status=${filter}`}` : null);
  if (member?.role !== "admin") return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  return (
    <Screen header={false}>
      <View style={styles.chips}>
        {filters.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
            >
              <AppText variant="callout" style={{ color: active ? c.textOnAccent : c.text, fontWeight: "600" }}>
                {f.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {loading && !data ? <LoadingView /> : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {data && !data.length ? <EmptyState icon="checkmark-done-outline" title="沒有符合的訂單" /> : null}
      {data?.map((o) => <OrderCard key={o.id} order={o} showMember onPress={() => router.push(`/admin/orders/${o.id}`)} />)}
    </Screen>
  );
}

export default function AdminOrdersScreen() {
  return (
    <WebOnly>
      <AdminOrders />
    </WebOnly>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
});
