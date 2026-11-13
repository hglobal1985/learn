import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, type Order } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { eventDays, ntd } from "@/features/format";
import { MoneyArt } from "@/features/orders/money-art";
import { PaymentForm } from "@/features/orders/payment-form";
import { OrderTimeline } from "@/features/orders/timeline";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Button, Card, ErrorView, LoadingView, NoticeBox, Screen } from "@/ui";

/** 報名明細：金額（超大）、狀態、取消按鈕（第一個畫面就看得到）、審核人員與收費窗口、處理紀錄與留言（直接展開）。付款代碼還沒串金流，先不顯示。 */
function OrderDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invalidate } = useSession();
  const { data, error, loading, reload } = useApi<Order>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!data) return <Screen header={false}>{loading ? <LoadingView /> : <ErrorView message={error ?? "找不到這筆報名"} onRetry={reload} />}</Screen>;
  const cancel = async () => {
    if (!(await confirmSheet({ title: "取消報名", message: "確定要取消這筆報名嗎？取消後可以重新報名。", confirmLabel: "確定取消", cancelLabel: "先不要", danger: true }))) return;
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
  const total = data.items.reduce((n, i) => n + i.priceTwd, 0);
  return (
    <Screen header={false}>
      <Card style={styles.hero}>
        <MoneyArt size={72} />
        {data.items.map((i) => {
          // 系列、課程名稱、日期、地點排成一列；系列和課程名稱一樣就只顯示一次。
          const parts = [i.series && i.series !== i.title ? i.series : "", i.title, i.eventStart ? eventDays(i.eventStart, i.eventEnd) : "", i.place ?? ""].filter(Boolean);
          return (
            <AppText key={i.courseId} variant="headline" style={{ textAlign: "center" }}>
              {parts.join(" · ")}
            </AppText>
          );
        })}
        <AppText style={[styles.amount, { color: c.text }]} accessibilityLabel={`金額 ${total} 元`} adjustsFontSizeToFit numberOfLines={1}>
          {total ? ntd(total) : "免費"}
        </AppText>
      </Card>
      {data.status === "pending" ? (
        <Card>
          <View style={styles.person}>
            <Ionicons name="shield-checkmark-outline" size={22} color={c.accentText} />
            <AppText variant="callout" tone="muted">
              審核人員
            </AppText>
            <AppText variant="headline" style={{ flex: 1 }}>
              {data.reviewers?.length ? data.reviewers.join("、") : "總部（尚未指定）"}
            </AppText>
          </View>
          <View style={styles.person}>
            <Ionicons name="wallet-outline" size={22} color={c.accentText} />
            <AppText variant="callout" tone="muted">
              收費窗口
            </AppText>
            <AppText variant="headline" style={{ flex: 1 }}>
              {data.collectors?.length ? data.collectors.join("、") : "總部（尚未指定）"}
            </AppText>
          </View>
        </Card>
      ) : null}
      {data.status === "pending" ? <PaymentForm order={data} onDone={reload} leftAction={<Button variant="danger" label="取消報名" loading={busy} disabled={busy} onPress={cancel} fullWidth />} /> : null}
      {data.status === "opened" ? <Button label="前往學習中的課程" onPress={() => router.navigate("/learning")} fullWidth /> : null}
      {data.status === "rejected" && !data.revoked ? <Button label="回到課程頁重新報名" onPress={() => router.push(`/course/${data.items[0]?.courseId}`)} fullWidth /> : null}

      {data.status === "opened" ? <NoticeBox tone="success" text="課程已開通，可以開始上課了。" /> : null}
      {data.rejectReason && data.status !== "opened" ? <NoticeBox tone="danger" text={`原因：${data.rejectReason}`} /> : null}
      {err ? <NoticeBox tone="danger" text={err} /> : null}

      <OrderTimeline order={data} canDeletePayments={data.status === "pending"} />
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

const styles = StyleSheet.create({
  info: { alignItems: "center", gap: 2 },
  hero: { alignItems: "center", gap: space.xs, paddingVertical: space.md },
  amount: { fontSize: 60, lineHeight: 68, fontWeight: "900", letterSpacing: -1 },
  person: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  code: { fontSize: 30, fontWeight: "900", letterSpacing: 2, flexShrink: 1 },
  copy: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: space.md, borderWidth: 1.5, borderRadius: radius.pill },
});
