import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { api, type Order } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, EmptyState, ErrorView, LoadingView, NoticeBox, Screen } from "@/ui";

function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const { data, error, loading, reload } = useApi<Order>(member?.role === "admin" ? `/orders/${id}` : null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  if (member?.role !== "admin") return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  if (!data) return <Screen header={false}>{loading ? <LoadingView /> : <ErrorView message={error ?? "找不到這筆報名"} onRetry={reload} />}</Screen>;

  const review = async (approve: boolean) => {
    setBusy(approve ? "approve" : "reject");
    setMessage(null);
    try {
      await api<Order>("POST", `/admin/orders/${data.id}/review`, { approve, reason });
      setDone(true);
      setMessage({ tone: "success", text: approve ? "已確認繳費並開通課程，已通知學員。" : "已退回報名，已通知學員。" });
      invalidate();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen header={false}>
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      <OrderCard order={data} showMember />
      {data.status === "pending" && !done ? (
        <View style={{ gap: space.md }}>
          <AppText variant="headline">確認繳費</AppText>
          <AppText variant="callout" tone="muted">
            請先核對匯款紀錄與報名編號，確認無誤再開通。
          </AppText>
          <Button label="已繳費，開通課程" icon="checkmark-circle" loading={busy === "approve"} disabled={!!busy} onPress={() => review(true)} fullWidth />
          <AppText variant="callout" tone="muted">
            未通過原因（退回時必填，會通知學員）
          </AppText>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="例如：尚未查到款項"
            placeholderTextColor={c.textMuted}
            maxLength={300}
            multiline
            accessibilityLabel="未通過原因"
            style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          />
          <Button variant="danger" label="退回報名" icon="close-circle" loading={busy === "reject"} disabled={!!busy} onPress={() => review(false)} fullWidth />
        </View>
      ) : null}
    </Screen>
  );
}

export default function ReviewScreen() {
  return (
    <WebOnly>
      <Review />
    </WebOnly>
  );
}

const styles = StyleSheet.create({ input: { minHeight: minTouch * 2, borderWidth: 1, borderRadius: radius.md, padding: space.md, textAlignVertical: "top" } });
