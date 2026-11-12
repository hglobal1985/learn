import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { AppText, Button, Card, EmptyState, ErrorView, Field, LoadingView, NoticeBox, Screen, Section } from "@/ui";

type Quote = { id: string; text: string };

/** 最高管理員（超級管理員）：編輯首頁「繼續學習」下方的學習金句，每次進入首頁隨機顯示一則。 */
export default function QuotesScreen() {
  const { member } = useSession();
  const ok = !!member?.titles.includes("超級管理員");
  const { data, error, reload } = useApi<Quote[]>(ok ? "/admin/quotes" : null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  if (!ok) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="只有超級管理員可以編輯" /></Screen>;
  if (!data) return <Screen header={false}>{error ? <ErrorView message={error} onRetry={reload} /> : <LoadingView />}</Screen>;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen header={false}>
      <NoticeBox text="每次進入首頁，「繼續學習」下方會隨機顯示一則金句。每則最多 120 字。" />
      <Section title="新增金句">
        <Card>
          <Field label="金句內容" value={text} onChange={setText} multiline />
          <Button label="新增" icon="add-circle-outline" disabled={busy || !text.trim()} onPress={() => run(async () => { await api("POST", "/admin/quotes", { text }); setText(""); })} fullWidth />
        </Card>
      </Section>
      {msg ? <NoticeBox tone="danger" text={msg} /> : null}
      <Section title={`所有金句（${data.length}）`}>
        {data.map((q) => (
          <Card key={q.id}>
            {editing?.id === q.id ? (
              <>
                <Field label="金句內容" value={editing.text} onChange={(v) => setEditing({ id: q.id, text: v })} multiline />
                <View style={styles.row}>
                  <Button label="儲存" disabled={busy || !editing.text.trim()} onPress={() => run(async () => { await api("PATCH", `/admin/quotes/${q.id}`, { text: editing.text }); setEditing(null); })} />
                  <Button variant="ghost" label="取消" onPress={() => setEditing(null)} />
                </View>
              </>
            ) : (
              <>
                <AppText>{q.text}</AppText>
                <View style={styles.row}>
                  <Button variant="secondary" label="編輯" disabled={busy} onPress={() => setEditing({ id: q.id, text: q.text })} />
                  <Button variant="danger" label="刪除" disabled={busy} onPress={() => run(() => api("DELETE", `/admin/quotes/${q.id}`))} />
                </View>
              </>
            )}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
