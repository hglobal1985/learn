import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api, type CourseSummary, type Order } from "@/api/client";
import { ntd } from "@/features/format";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ListRow, LoadingView, NoticeBox, Screen } from "@/ui";

function Cart() {
  const { member, cart, setCart, invalidate } = useSession();
  const { data } = useApi<CourseSummary[]>("/courses");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = (data ?? []).filter((c) => cart.includes(c.id));
  const total = items.reduce((sum, c) => sum + (c.priceTwd ?? 0), 0);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const orders = await api<Order[]>("POST", "/orders", { courseIds: items.map((c) => c.id) });
      setCart([]);
      invalidate();
      const pending = orders.find((o) => o.status === "pending");
      router.replace(pending ? `/orders/${pending.id}` : "/learning");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Screen header={false}><LoadingView /></Screen>;
  if (!items.length)
    return (
      <Screen header={false}>
        <EmptyState icon="cart-outline" title="報名清單是空的" action={<Button label="去逛課程" onPress={() => router.navigate("/courses")} />} />
      </Screen>
    );
  return (
    <Screen header={false}>
      <Card style={{ paddingVertical: 0 }}>
        {items.map((c) => (
          <ListRow
            key={c.id}
            icon="book-outline"
            title={c.title}
            subtitle={c.priceTwd ? ntd(c.priceTwd) : "免費"}
            right={<Button variant="ghost" label="移除" onPress={() => setCart(cart.filter((x) => x !== c.id))} />}
          />
        ))}
      </Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="headline">合計</AppText>
        <AppText variant="title">{ntd(total)}</AppText>
      </View>
      <NoticeBox text="目前不接受線上刷卡。送出後會建立待審核報名，請依報名窗口說明繳費，管理員確認繳費後開通（內部測試期間不需實際繳費）。" />
      {error ? <NoticeBox tone="danger" text={error} /> : null}
      <View style={{ gap: space.sm }}>
        {member ? (
          <Button label="送出報名" icon="checkmark" loading={busy} onPress={checkout} fullWidth />
        ) : (
          <Button label="登入後報名" onPress={() => router.navigate("/me")} fullWidth />
        )}
      </View>
    </Screen>
  );
}

export default function CartScreen() {
  return (
    <WebOnly>
      <Cart />
    </WebOnly>
  );
}
