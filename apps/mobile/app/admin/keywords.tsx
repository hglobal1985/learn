import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { api, KEYWORD_INFO, type KeywordItem, type KeywordKind, type KeywordLists } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";
import { BottomSheet } from "@/ui/bottom-sheet";
import { SeriesEdm } from "@/features/admin/series-edm";
import { useApi, useSession } from "@/state/session";

const KINDS: KeywordKind[] = ["category", "series", "location"];

/** 關鍵字管理（超級管理員）：集中新增、改名、刪除「分類、系列、場地」。改名會同步更新所有用到的課程；刪除會把那些課程的欄位清空。 */
export default function KeywordsScreen() {
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const isSuper = !!member?.titles.includes("超級管理員");
  const { data, error, loading, reload } = useApi<KeywordLists>(isSuper ? "/admin/keywords" : null);
  const [drafts, setDrafts] = useState<Record<KeywordKind, string>>({ category: "", series: "", location: "" });
  const [rename, setRename] = useState<{ kind: KeywordKind; from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  if (!isSuper)
    return (
      <Screen header={false}>
        <EmptyState icon="lock-closed-outline" title="只有超級管理員可以管理關鍵字" />
      </Screen>
    );

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      invalidate();
      reload();
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const add = (kind: KeywordKind) => {
    const value = drafts[kind].trim();
    if (!value) return;
    run(() => api("POST", "/admin/keywords", { kind, value }), `已新增「${value}」`).then(() => setDrafts((d) => ({ ...d, [kind]: "" })));
  };
  const remove = async (kind: KeywordKind, item: KeywordItem) => {
    const ok = await confirmSheet({
      title: `刪除${KEYWORD_INFO[kind].title}「${item.value}」`,
      message: item.count ? `有 ${item.count} 門課程正在使用。刪除後，這些課程的「${KEYWORD_INFO[kind].title}」會變成空白，課程本身不會刪除。` : "目前沒有課程使用這個關鍵字。",
      confirmLabel: "刪除",
      cancelLabel: "先不要",
      danger: true,
    });
    if (ok) run(() => api("POST", "/admin/keywords/remove", { kind, value: item.value }), `已刪除「${item.value}」`);
  };
  const doRename = () => {
    if (!rename) return;
    const to = rename.to.trim();
    if (!to || to === rename.from) return setRename(null);
    const r = rename;
    setRename(null);
    run(() => api("PATCH", "/admin/keywords", { kind: r.kind, from: r.from, to }), `已改名為「${to}」，用到的課程都已更新`);
  };

  return (
    <Screen header={false}>
      <AppText variant="callout" tone="muted">
        集中管理課程的「分類、系列、場地」。改名會同步更新所有用到的課程；新增的關鍵字會出現在課程編輯頁的「已有的…」選項裡。
      </AppText>
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data
        ? KINDS.map((kind) => (
            <Section key={kind} title={KEYWORD_INFO[kind].title}>
              <Card>
                <AppText variant="caption" tone="muted">
                  {KEYWORD_INFO[kind].hint}
                </AppText>
                {data[kind].length ? (
                  data[kind].map((item) => (
                    <View key={item.value} style={[styles.row, { borderTopColor: c.border }]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="callout" style={{ fontWeight: "700" }}>
                          {item.value}
                        </AppText>
                        <View style={styles.tags}>
                          <Pill label={item.count ? `${item.count} 門課程使用` : "尚未使用"} tone={item.count ? "accent" : "neutral"} />
                        </View>
                        {kind === "series" ? <SeriesEdm series={item.value} edmUrl={item.edmUrl} onChanged={() => { invalidate(); reload(); }} /> : null}
                      </View>
                      <Button variant="secondary" label="改名" disabled={busy} onPress={() => setRename({ kind, from: item.value, to: item.value })} />
                      <Button variant="danger" label="刪除" disabled={busy} onPress={() => remove(kind, item)} />
                    </View>
                  ))
                ) : (
                  <AppText variant="callout" tone="muted">
                    還沒有任何{KEYWORD_INFO[kind].title}
                  </AppText>
                )}
                <View style={styles.addRow}>
                  <TextInput
                    value={drafts[kind]}
                    onChangeText={(v) => setDrafts((d) => ({ ...d, [kind]: v }))}
                    placeholder={`新增${KEYWORD_INFO[kind].title}`}
                    placeholderTextColor={c.textMuted}
                    accessibilityLabel={`新增${KEYWORD_INFO[kind].title}`}
                    onSubmitEditing={() => add(kind)}
                    style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                  />
                  <Button label="新增" icon="add-outline" disabled={busy || !drafts[kind].trim()} onPress={() => add(kind)} />
                </View>
              </Card>
            </Section>
          ))
        : null}
      {rename ? (
        <BottomSheet onClose={() => setRename(null)}>
          <AppText variant="headline">
            {KEYWORD_INFO[rename.kind].title}改名：{rename.from}
          </AppText>
          <TextInput
            value={rename.to}
            onChangeText={(v) => setRename({ ...rename, to: v })}
            autoFocus
            accessibilityLabel="新名稱"
            style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          />
          <AppText variant="caption" tone="muted">
            所有使用「{rename.from}」的課程會一起改成新名稱；如果新名稱已經存在，會合併在一起。
          </AppText>
          <View style={styles.sheetButtons}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label="取消" onPress={() => setRename(null)} fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="確定改名" onPress={doRename} fullWidth />
            </View>
          </View>
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  addRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: { flex: 1, minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  sheetButtons: { flexDirection: "row", gap: space.sm },
});
