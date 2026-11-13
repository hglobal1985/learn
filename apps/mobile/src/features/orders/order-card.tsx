import { StyleSheet, View } from "react-native";
import { applicantLabel, type Order } from "@/api/client";
import { dateTime, ntd, orderStatus, payMethodLabel } from "@/features/format";
import { space } from "@/theme/tokens";
import { AppText, Card, Pill } from "@/ui";

export function OrderCard({ order, onPress, showMember }: { order: Order; onPress?: () => void; showMember?: boolean }) {
  const s = orderStatus(order);
  return (
    <Card onPress={onPress} accessibilityLabel={`報名 ${order.id}，${s.label}`}>
      <View style={styles.head}>
        <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
          {order.id}{order.payRef ? ` · 付款代碼 ${order.payRef}` : ""} · {dateTime(order.createdAt)}
        </AppText>
        <Pill label={s.label} tone={s.tone} />
      </View>
      {showMember ? (
        <View style={styles.head}>
          <AppText variant="headline">{applicantLabel(order.legalName, order.memberName)}</AppText>
          {order.memberSub ? <AppText variant="caption" tone="muted" selectable>會員 ID：{order.memberSub}</AppText> : null}
          {order.centerLabel ? <Pill label={order.centerLabel} tone="accent" /> : null}
          {!order.hglobal ? <Pill label="非寰宇系統" tone="warning" /> : null}
        </View>
      ) : null}
      {!showMember && order.payRef && order.status === "pending" ? (
        <AppText variant="callout" tone="warning">
          匯款時請在備註填寫付款代碼：{order.payRef}（窗口用代碼核對款項）
        </AppText>
      ) : null}
      {order.items.map((i) => (
        <View key={`${i.courseId}:${i.runId}`} style={styles.head}>
          <AppText style={{ flex: 1 }}>{i.title}</AppText>
          <AppText tone="muted">{i.priceTwd ? ntd(i.priceTwd) : "免費"}</AppText>
        </View>
      ))}
      {order.payMethod && order.payMethod !== "free" ? (
        <AppText variant="callout" tone="muted">
          實收 {ntd(order.paidTwd ?? 0)}（{payMethodLabel[order.payMethod]}）
        </AppText>
      ) : null}
      {order.rejectReason && order.status !== "opened" ? <AppText tone={order.status === "rejected" ? "danger" : "muted"}>原因：{order.rejectReason}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({ head: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" } });
