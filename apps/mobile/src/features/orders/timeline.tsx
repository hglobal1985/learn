import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api, PAYMENT_METHODS, type Order, type PaymentReport } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { dateTime, eventLabel } from "@/features/format";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, NoticeBox, Section } from "@/ui";
import { showToast } from "@/ui/toast";

/** 操作紀錄（誰、何時、做了什麼）與留言。reviewer＝審核人員視角（可寫私人備註）。 */
export function OrderTimeline({ order, reviewer, canDeletePayments }: { order: Order; reviewer?: boolean; canDeletePayments?: boolean }) {
  const { c } = useTheme();
  const { invalidate } = useSession();
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("POST", `/orders/${order.id}/events`, { message, note });
      setMessage("");
      setNote("");
      invalidate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // 操作紀錄、留言、繳費回報合併成一條，依日期時間排序（舊的在上、新的在下）。
  type Item = { at: string; kind: "event"; e: NonNullable<Order["events"]>[number] } | { at: string; kind: "pay"; p: PaymentReport };
  const items: Item[] = [
    ...(order.events ?? []).map((e): Item => ({ at: e.createdAt, kind: "event", e })),
    ...(order.payments ?? []).map((p): Item => ({ at: p.createdAt, kind: "pay", p })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const methodText = (p: PaymentReport) => PAYMENT_METHODS.find((m) => m.key === p.method)?.label ?? p.method;
  const detail = (p: PaymentReport) => [p.last5 ? `末五碼 ${p.last5}` : "", p.friendName ? `朋友：${p.friendName}` : "", p.paidAt ? dateTime(p.paidAt) : ""].filter(Boolean).join("　");
  const removePayment = async (p: PaymentReport) => {
    if (!(await confirmSheet({ title: "刪除這筆回報", message: `確定要刪除「${methodText(p)}」這筆繳費回報嗎？`, confirmLabel: "刪除", cancelLabel: "先不要", danger: true }))) return;
    try {
      await api("DELETE", `/orders/${order.id}/payments/${p.id}`);
      showToast("已刪除");
      invalidate();
    } catch (e) {
      showToast((e as Error).message);
    }
  };
  const input = (value: string, set: (v: string) => void, label: string) => (
    <TextInput
      value={value}
      onChangeText={set}
      placeholder={label}
      placeholderTextColor={c.textMuted}
      maxLength={500}
      multiline
      accessibilityLabel={label}
      style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
    />
  );
  return (
    <Section title="處理紀錄與留言">
      <Card>
        {items.map((it) =>
          it.kind === "pay" ? (
            <View key={it.p.id} style={[styles.event, { borderLeftColor: c.accent }]}>
              <View style={styles.payRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="caption" tone="muted">
                    {dateTime(it.p.createdAt)}｜繳費回報
                  </AppText>
                  <AppText variant="headline">{methodText(it.p)}</AppText>
                  {detail(it.p) ? (
                    <AppText variant="callout" tone="muted">
                      {detail(it.p)}
                    </AppText>
                  ) : null}
                </View>
                {canDeletePayments ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="刪除這筆回報" onPress={() => removePayment(it.p)} hitSlop={8} style={styles.trash}>
                    <Ionicons name="trash-outline" size={22} color={c.danger} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            <View key={it.e.id} style={[styles.event, { borderLeftColor: it.e.action === "note" ? c.warning : c.accent }]}>
              <AppText variant="caption" tone="muted">
                {dateTime(it.e.createdAt)}｜{it.e.actorTitle ? `${it.e.actorTitle} ` : ""}
                {it.e.actorName}
                {it.e.mine ? "（我）" : ""}
              </AppText>
              {it.e.action === "message" ? (
                <AppText variant="headline">{it.e.message}</AppText>
              ) : (
                <>
                  <AppText variant="headline">
                    {eventLabel[it.e.action] ?? it.e.action}
                    {it.e.reason ? `：${it.e.reason}` : ""}
                  </AppText>
                  {it.e.message ? <AppText>{it.e.message}</AppText> : null}
                </>
              )}
              {it.e.note ? (
                <AppText variant="callout" tone="warning">
                  私人備註（學員看不到）：{it.e.note}
                </AppText>
              ) : null}
            </View>
          ),
        )}
      </Card>
      <Card>
        {input(message, setMessage, reviewer ? "留言給學員（對方會收到通知）" : "留言給審核人員")}
        {reviewer ? input(note, setNote, "私人備註（只有審核人員看得到）") : null}
        {error ? <NoticeBox tone="danger" text={error} /> : null}
        <View style={{ flexDirection: "row" }}>
          <Button variant="secondary" label="送出" icon="send-outline" loading={busy} disabled={!message.trim() && !note.trim()} onPress={send} />
        </View>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  payRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  event: { borderLeftWidth: 3, paddingLeft: space.md, gap: 2, marginBottom: space.sm },
  input: { minHeight: minTouch * 1.5, borderWidth: 1, borderRadius: radius.md, padding: space.md, textAlignVertical: "top" },
});
