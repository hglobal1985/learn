import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { shareLink } from "@/lib/share";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, LoadingView, NoticeBox, Screen, Section, ShareIcon } from "@/ui";
import { showToast } from "@/ui/toast";

type Item = { kind: "category" | "series"; value: string; slug: string | null };
const PREFIX = { category: "c", series: "s" } as const;
const TITLE = { category: "分類", series: "系列" } as const;
const host = () => (typeof location !== "undefined" ? location.host : "learn.hglobal1985.com");

/** 短網址（超級管理員）：替每個分類、系列自訂英文縮寫，網址 /c/縮寫（分類）、/s/縮寫（系列），開啟後直接顯示該分類／系列的課程。 */
export default function ShortLinksScreen() {
  const { c } = useTheme();
  const { member } = useSession();
  const isSuper = !!member?.titles.includes("超級管理員");
  const { data, error, loading, reload } = useApi<Item[]>(isSuper ? "/admin/short-links" : null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  if (!isSuper)
    return (
      <Screen header={false}>
        <EmptyState icon="lock-closed-outline" title="只有超級管理員可以設定短網址" />
      </Screen>
    );
  const keyOf = (i: Item) => `${i.kind}:${i.value}`;
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      reload();
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const save = (i: Item) => {
    const slug = (drafts[keyOf(i)] ?? i.slug ?? "").trim().toLowerCase();
    run(keyOf(i), () => api("PUT", "/admin/short-links", { kind: i.kind, value: i.value, slug }), `已儲存：${host()}/${PREFIX[i.kind]}/${slug}`).then(() =>
      setDrafts((d) => {
        const { [keyOf(i)]: _gone, ...rest } = d;
        return rest;
      }),
    );
  };
  const share = async (i: Item) => {
    const r = await shareLink(i.value, `/${PREFIX[i.kind]}/${i.slug}`);
    if (r === "copied") showToast("已複製短網址");
  };

  return (
    <Screen header={false}>
      <AppText variant="callout" tone="muted">
        替分類、系列自訂英文縮寫（小寫英文、數字、連字號，2～30 字）。{"\n"}分類網址：{host()}/c/縮寫{"\n"}系列網址：{host()}/s/縮寫{"\n"}別人開啟短網址，就會直接看到該分類或系列的課程。
      </AppText>
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data
        ? (["category", "series"] as const).map((kind) => {
            const items = data.filter((x) => x.kind === kind);
            return (
              <Section key={kind} title={TITLE[kind]}>
                {items.length ? (
                  items.map((i) => {
                    const key = keyOf(i);
                    const value = drafts[key] ?? i.slug ?? "";
                    const dirty = value.trim().toLowerCase() !== (i.slug ?? "");
                    return (
                      <Card key={key}>
                        <AppText variant="headline">{i.value}</AppText>
                        <View style={styles.inputRow}>
                          <AppText variant="callout" tone="muted">
                            /{PREFIX[kind]}/
                          </AppText>
                          <TextInput
                            value={value}
                            onChangeText={(v) => setDrafts((d) => ({ ...d, [key]: v.replace(/[^A-Za-z0-9-]/g, "") }))}
                            placeholder="英文縮寫"
                            placeholderTextColor={c.textMuted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={30}
                            accessibilityLabel={`${i.value} 的短網址縮寫`}
                            style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                          />
                        </View>
                        <View style={styles.btnRow}>
                          <Button label="儲存" icon="checkmark-outline" disabled={!!busy || !dirty || !value.trim()} loading={busy === key} onPress={() => save(i)} />
                          {i.slug && !dirty ? (
                            <>
                              <Pressable accessibilityRole="button" accessibilityLabel={`分享 ${i.value} 的短網址`} onPress={() => share(i)} style={[styles.shareBtn, { borderColor: c.border }]}>
                                <ShareIcon size={22} color={c.text} />
                              </Pressable>
                              <Button variant="danger" label="清除" disabled={!!busy} onPress={() => run(key, () => api("POST", "/admin/short-links/remove", { kind, value: i.value }), `已清除「${i.value}」的短網址`)} />
                            </>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })
                ) : (
                  <AppText variant="callout" tone="muted">
                    還沒有任何{TITLE[kind]}（先到「關鍵字管理」新增）
                  </AppText>
                )}
              </Section>
            );
          })
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  input: { flex: 1, minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  btnRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  shareBtn: { width: minTouch, height: minTouch, borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
