import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, type Order } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { ntd, orderStatus } from "@/features/format";
import { MoneyArt } from "@/features/orders/money-art";
import { OrderTimeline } from "@/features/orders/timeline";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Button, Card, ErrorView, LoadingView, NoticeBox, Pill, Screen } from "@/ui";
import { showToast } from "@/ui/toast";

/** 報名明細：只放最重要的——要繳多少錢（超大）、付款代碼、狀態、取消。處理紀錄收在最下面，點開才看。 */
function OrderDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invalidate } = useSession();
  const { data, error, loading, reload } = useApi<Order>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState(false);
  if (!data) return <Screen header={false}>{loading ? <LoadingView /> : <ErrorView message={error ?? "找不到這筆報名"} onRetry={reload} />}</Screen>;
  const st = orderStatus(data);
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
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.payRef ?? "");
      showToast("已複製付款代碼");
    } catch {
      showToast("請長按代碼複製");
    }
  };
  const title = data.items.map((i) => i.title).join("、");
  const total = data.items.reduce((n, i) => n + i.priceTwd, 0);
  return (
    <Screen header={false}>
      <Card style={styles.hero}>
        <MoneyArt size={104} />
        <AppText variant="callout" tone="muted" numberOfLines={2} style={{ textAlign: "center" }}>
          {title}
        </AppText>
        <AppText style={[styles.amount, { color: c.text }]} accessibilityLabel={`金額 ${total} 元`} adjustsFontSizeToFit numberOfLines={1}>
          {total ? ntd(total) : "免費"}
        </AppText>
        <View style={{ alignSelf: "center" }}>
          <Pill label={st.label} tone={st.tone} />
        </View>
      </Card>

      {data.status === "pending" && data.payRef ? (
        <Card>
          <AppText variant="callout" tone="muted">
            付款代碼（繳費時告知窗口，匯款請填在備註）
          </AppText>
          <View style={styles.codeRow}>
            <AppText style={[styles.code, { color: c.accentText }]} selectable>
              {data.payRef}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="複製付款代碼" onPress={copy} style={[styles.copy, { borderColor: c.accent }]}>
              <Ionicons name="copy-outline" size={22} color={c.accentText} />
              <AppText variant="callout" style={{ color: c.accentText, fontWeight: "700" }}>
                複製
              </AppText>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {data.status === "opened" ? <NoticeBox tone="success" text="課程已開通，可以開始上課了。" /> : null}
      {data.rejectReason && data.status !== "opened" ? <NoticeBox tone="danger" text={`原因：${data.rejectReason}`} /> : null}
      {err ? <NoticeBox tone="danger" text={err} /> : null}

      {data.status === "pending" ? <Button variant="danger" label="取消報名" icon="close-circle-outline" loading={busy} disabled={busy} onPress={cancel} fullWidth /> : null}
      {data.status === "opened" ? <Button label="前往學習中的課程" onPress={() => router.navigate("/learning")} fullWidth /> : null}
      {data.status === "rejected" && !data.revoked ? <Button label="回到課程頁重新報名" onPress={() => router.push(`/course/${data.items[0]?.courseId}`)} fullWidth /> : null}

      <Button variant="ghost" label={log ? "收起處理紀錄" : "處理紀錄與留言"} icon={log ? "chevron-up" : "chevron-down"} onPress={() => setLog((v) => !v)} fullWidth />
      {log ? <OrderTimeline order={data} /> : null}
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
  hero: { alignItems: "center", gap: space.sm, paddingVertical: space.xl },
  amount: { fontSize: 64, lineHeight: 72, fontWeight: "900", letterSpacing: -1 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  code: { fontSize: 30, fontWeight: "900", letterSpacing: 2, flexShrink: 1 },
  copy: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: space.md, borderWidth: 1.5, borderRadius: radius.pill },
});
