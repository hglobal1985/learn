import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api, REVIEW_REASONS, type Order, type ReviewAction, type ReviewReason } from "@/api/client";
import { OrderCard } from "@/features/orders/order-card";
import { OrderTimeline } from "@/features/orders/timeline";
import { WebOnly } from "@/features/web-only";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, Chips, ErrorView, Field, LoadingView, NoticeBox, Screen, Section } from "@/ui";

const reasons = (Object.keys(REVIEW_REASONS) as ReviewReason[]).map((key) => ({ key, label: REVIEW_REASONS[key] }));
const done: Record<ReviewAction, string> = {
  paid: "已確認繳費並開通課程，已通知學員。",
  vip: "已以 VIP 免繳費開通，已通知學員。",
  reject: "已退回報名，已通知學員。",
  defer: "已延後審核，已通知學員。",
  revoke: "已撤銷開通，已通知學員。",
};

function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invalidate } = useSession();
  const { data, error, loading, reload } = useApi<Order>(`/orders/${id}`);
  const [mode, setMode] = useState<"reject" | "defer" | "revoke" | null>(null);
  const [reason, setReason] = useState<ReviewReason | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState<string | null>(null);
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [busy, setBusy] = useState<ReviewAction | null>(null);
  const [result, setResult] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  if (!data) return <Screen header={false}>{loading ? <LoadingView /> : <ErrorView message={error ?? "找不到這筆報名"} onRetry={reload} />}</Screen>;

  const act = async (action: ReviewAction) => {
    setBusy(action);
    setResult(null);
    try {
      await api<Order>("POST", `/admin/orders/${data.id}/review`, {
        action,
        reasonCode: reason,
        message,
        note,
        ...(action === "paid" ? { paidTwd: Number(paid ?? data.totalTwd), payMethod: method } : {}),
      });
      setResult({ tone: "success", text: done[action] });
      setMode(null);
      setReason(null);
      setMessage("");
      setNote("");
      invalidate();
    } catch (e) {
      setResult({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const pending = data.status === "pending" && data.canReview;

  return (
    <Screen header={false}>
      {result ? <NoticeBox tone={result.tone} text={result.text} /> : null}
      <OrderCard order={data} showMember />
      {data.status === "pending" && !data.canReview ? <NoticeBox text="不能審核自己的報名。" /> : null}
      {pending ? (
        <Section title="審核">
          <Card>
            <AppText variant="headline">確認繳費</AppText>
            <Field label="實收金額（新台幣）" value={paid ?? String(data.totalTwd)} onChange={setPaid} numeric />
            <Chips label="繳費方式" options={[{ key: "cash", label: "現金" }, { key: "transfer", label: "轉帳" }]} value={method} onChange={setMethod} />
            <View style={{ gap: space.sm }}>
              <Button label="已繳費，開通課程" icon="checkmark-circle" loading={busy === "paid"} disabled={!!busy} onPress={() => act("paid")} fullWidth />
              <Button variant="secondary" label="VIP 免繳費，開通課程" icon="ribbon-outline" loading={busy === "vip"} disabled={!!busy} onPress={() => act("vip")} fullWidth />
            </View>
          </Card>
          <Card>
            <AppText variant="headline">退回或延後</AppText>
            <Chips label="處理方式" options={[{ key: "defer", label: "延後再審" }, { key: "reject", label: "退回" }]} value={mode === "revoke" ? null : mode} onChange={setMode} />
            {mode ? (
              <>
                <AppText variant="callout" tone="muted">
                  原因（會通知學員）
                </AppText>
                <Chips label="原因" options={reasons} value={reason} onChange={setReason} />
              </>
            ) : null}
          </Card>
        </Section>
      ) : null}
      {data.canRevoke ? (
        <Card>
          <AppText variant="headline">撤銷開通</AppText>
          <AppText variant="callout" tone="muted">
            按錯或事後退費時使用；學員將無法再觀看，並會收到通知。
          </AppText>
          {mode === "revoke" ? <Chips label="原因" options={reasons} value={reason} onChange={setReason} /> : <Button variant="secondary" label="我要撤銷這筆開通" onPress={() => (setMode("revoke"), setReason(null))} />}
        </Card>
      ) : null}
      {pending || mode === "revoke" ? (
        <Card>
          <Field label={reason === "other" ? "原因說明（必填，學員看得到）" : "給學員的留言（選填）"} value={message} onChange={setMessage} multiline />
          <Field label="私人備註（選填，只有審核人員看得到）" value={note} onChange={setNote} multiline />
          {mode ? (
            <Button
              variant="danger"
              label={mode === "defer" ? "確認延後再審" : mode === "reject" ? "確認退回報名" : "確認撤銷開通"}
              icon="alert-circle-outline"
              loading={busy === mode}
              disabled={!!busy || !reason || (reason === "other" && !message.trim())}
              onPress={() => act(mode)}
              fullWidth
            />
          ) : null}
        </Card>
      ) : null}
      <OrderTimeline order={data} reviewer />
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
