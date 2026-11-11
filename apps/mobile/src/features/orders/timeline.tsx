import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { api, type Order } from "@/api/client";
import { dateTime, eventLabel } from "@/features/format";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, NoticeBox, Section } from "@/ui";

/** 操作紀錄（誰、何時、做了什麼）與留言。reviewer＝審核人員視角（可寫私人備註）。 */
export function OrderTimeline({ order, reviewer }: { order: Order; reviewer?: boolean }) {
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
        {(order.events ?? []).map((e) => (
          <View key={e.id} style={[styles.event, { borderLeftColor: e.action === "note" ? c.warning : c.accent }]}>
            <AppText variant="caption" tone="muted">
              {dateTime(e.createdAt)}｜{e.actorTitle ? `${e.actorTitle} ` : ""}
              {e.actorName}
              {e.mine ? "（我）" : ""}
            </AppText>
            <AppText variant="headline">
              {eventLabel[e.action] ?? e.action}
              {e.reason ? `：${e.reason}` : ""}
            </AppText>
            {e.message ? <AppText>{e.message}</AppText> : null}
            {e.note ? (
              <AppText variant="callout" tone="warning">
                私人備註（學員看不到）：{e.note}
              </AppText>
            ) : null}
          </View>
        ))}
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
  event: { borderLeftWidth: 3, paddingLeft: space.md, gap: 2, marginBottom: space.sm },
  input: { minHeight: minTouch * 1.5, borderWidth: 1, borderRadius: radius.md, padding: space.md, textAlignVertical: "top" },
});
