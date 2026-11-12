import { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { api, type CourseComment } from "@/api/client";
import { dateTime } from "@/features/format";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, Field, NoticeBox, Pill, Section } from "@/ui";

function confirm(message: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(message));
  return new Promise((r) => Alert.alert("請確認", message, [{ text: "取消", style: "cancel", onPress: () => r(false) }, { text: "確定", onPress: () => r(true) }]));
}

/** 課程留言板：登入會員可留言；可檢舉、封鎖對方（商店規範要求）；管理員可隱藏。 */
export function CommentBoard({ courseId }: { courseId: string }) {
  const { member, invalidate } = useSession();
  const { data, error } = useApi<CourseComment[]>(`/courses/${courseId}/comments`);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const admin = member?.role === "admin";

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg({ tone: "success", text: done });
      invalidate();
      return true;
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={`留言板${data ? `（${data.length}）` : ""}`}>
      <Card>
        <Field label="留言" value={body} onChange={setBody} placeholder="分享你的心得或提問（請保持友善）" multiline />
        <View style={styles.row}>
          <Button
            label="送出留言"
            icon="chatbubble-outline"
            loading={busy}
            disabled={!body.trim()}
            onPress={async () => {
              if (await run(() => api("POST", `/courses/${courseId}/comments`, { body }))) setBody("");
            }}
          />
        </View>
      </Card>
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      {error && !data ? <NoticeBox tone="danger" text={error} /> : null}
      {data && !data.length ? <NoticeBox text="還沒有留言，成為第一個留言的人吧。" /> : null}
      {data?.map((c) => (
        <Card key={c.id}>
          <View style={styles.row}>
            <AppText variant="headline" style={{ flex: 1 }}>
              {c.authorName}
              {c.mine ? "（我）" : ""}
            </AppText>
            {c.hidden ? <Pill label="已隱藏" tone="danger" /> : null}
            <AppText variant="caption" tone="muted">
              {dateTime(c.createdAt)}
            </AppText>
          </View>
          <AppText>{c.body}</AppText>
          <View style={styles.row}>
            {c.mine ? (
              <Button variant="ghost" label="刪除" disabled={busy} onPress={async () => (await confirm("確定刪除這則留言？")) && run(() => api("DELETE", `/comments/${c.id}`))} />
            ) : (
              <>
                <Button variant="ghost" label="檢舉" disabled={busy} onPress={async () => (await confirm("檢舉這則留言？管理員會收到通知並處理。")) && run(() => api("POST", `/comments/${c.id}/report`, {}), "已送出檢舉，謝謝你。")} />
                <Button variant="ghost" label="封鎖此人" disabled={busy} onPress={async () => (await confirm(`封鎖後你將不再看到「${c.authorName}」的留言。`)) && run(() => api("POST", `/comments/${c.id}/block`), "已封鎖。")} />
              </>
            )}
            {admin ? <Button variant="ghost" label={c.hidden ? "取消隱藏" : "隱藏"} disabled={busy} onPress={() => run(() => api("PATCH", `/admin/comments/${c.id}`, { hidden: !c.hidden }))} /> : null}
          </View>
        </Card>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm } });
