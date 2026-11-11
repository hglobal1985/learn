import { StyleSheet, View } from "react-native";
import type { Order } from "@/api/client";
import { dateTime, ntd, orderStatusLabel } from "@/features/format";
import { space } from "@/theme/tokens";
import { AppText, Card, Pill } from "@/ui";

export function OrderCard({ order, onPress, showMember }: { order: Order; onPress?: () => void; showMember?: boolean }) {
  const s = orderStatusLabel[order.status];
  return (
    <Card onPress={onPress} accessibilityLabel={`報名 ${order.id}，${s.label}`}>
      <View style={styles.head}>
        <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
          {order.id} · {dateTime(order.createdAt)}
        </AppText>
        <Pill label={s.label} tone={s.tone} />
      </View>
      {showMember ? <AppText variant="headline">{order.memberName}</AppText> : null}
      {order.items.map((i) => (
        <View key={i.courseId} style={styles.head}>
          <AppText style={{ flex: 1 }}>{i.title}</AppText>
          <AppText tone="muted">{i.priceTwd ? ntd(i.priceTwd) : "免費"}</AppText>
        </View>
      ))}
      <View style={styles.head}>
        <AppText variant="headline" style={{ flex: 1 }}>
          合計
        </AppText>
        <AppText variant="headline">{ntd(order.totalTwd)}</AppText>
      </View>
      {order.rejectReason ? <AppText tone="danger">未通過原因：{order.rejectReason}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({ head: { flexDirection: "row", alignItems: "center", gap: space.sm } });
