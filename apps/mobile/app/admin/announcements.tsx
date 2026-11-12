import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, type Announcement } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, Field, LoadingView, NoticeBox, Pill, Screen, Section, Ticker } from "@/ui";

/** 管理員（超級管理員、總部秘書）：首頁跑馬燈公告。多則公告會自動上下輪播，可排序、停用、編輯、刪除。手機單手即可操作。 */
export default function AnnouncementsScreen() {
  const { member } = useSession();
  const isAdmin = member?.role === "admin";
  const { data, error, reload } = useApi<Announcement[]>(isAdmin ? "/admin/announcements" : null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  if (!isAdmin) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  if (!data) return <Screen header={false}>{error ? <ErrorView message={error} onRetry={reload} /> : <LoadingView />}</Screen>;

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg({ tone: "success", text: done });
      reload();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const move = (i: number, d: -1 | 1) => {
    const ids = data.map((a) => a.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    return run(() => api("POST", "/admin/announcements/order", { ids }));
  };
  const live = data.filter((a) => a.enabled).map((a) => a.text);

  return (
    <Screen header={false}>
      <NoticeBox text="公告會顯示在首頁最上方，多則時自動上下輪播，使用者也可以用手指上下滑動查看。每則最多 120 字。" />
      <Section title="目前首頁效果">{live.length ? <Ticker items={live} /> : <AppText tone="muted">沒有啟用中的公告，首頁不會顯示跑馬燈。</AppText>}</Section>

      <Section title="新增公告">
        <Card>
          <Field label="公告內容" value={text} onChange={setText} placeholder="例如：11/30 前報名翡翠達標班享早鳥優惠" multiline />
          <Button label="新增公告" icon="add-circle-outline" disabled={busy || !text.trim()} loading={busy} onPress={() => run(async () => { await api("POST", "/admin/announcements", { text }); setText(""); }, "公告已新增")} fullWidth />
        </Card>
      </Section>
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}

      <Section title={`所有公告（${data.length}）`}>
        {!data.length ? <EmptyState icon="megaphone-outline" title="還沒有公告" body="在上方新增第一則公告。" /> : null}
        {data.map((a, i) => (
          <Card key={a.id}>
            <View style={styles.top}>
              <Pill label={a.enabled ? "顯示中" : "已停用"} tone={a.enabled ? "success" : "neutral"} />
              <AppText variant="caption" tone="muted">
                第 {i + 1} 則
              </AppText>
            </View>
            {editing?.id === a.id ? (
              <>
                <Field label="公告內容" value={editing.text} onChange={(v) => setEditing({ id: a.id, text: v })} multiline />
                <View style={styles.row}>
                  <Button label="儲存" disabled={busy || !editing.text.trim()} onPress={() => run(async () => { await api("PATCH", `/admin/announcements/${a.id}`, { text: editing.text }); setEditing(null); }, "已儲存")} />
                  <Button variant="ghost" label="取消" onPress={() => setEditing(null)} />
                </View>
              </>
            ) : (
              <>
                <AppText>{a.text}</AppText>
                <View style={styles.row}>
                  <Button variant="secondary" label={a.enabled ? "停用" : "啟用"} disabled={busy} onPress={() => run(() => api("PATCH", `/admin/announcements/${a.id}`, { enabled: !a.enabled }))} />
                  <Button variant="secondary" label="編輯" disabled={busy} onPress={() => setEditing({ id: a.id, text: a.text })} />
                  <Button variant="secondary" label="上移" icon="arrow-up" disabled={busy || i === 0} onPress={() => move(i, -1)} />
                  <Button variant="secondary" label="下移" icon="arrow-down" disabled={busy || i === data.length - 1} onPress={() => move(i, 1)} />
                  <Button variant="danger" label="刪除" disabled={busy} onPress={() => run(() => api("DELETE", `/admin/announcements/${a.id}`), "已刪除")} />
                </View>
              </>
            )}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
