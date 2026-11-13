import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, STATS_ROLE_OPTIONS, type MuxStats, type StatBlock } from "@/api/client";
import { dateTime } from "@/features/format";
import { useApi, useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, LoadingView, NoticeBox, Screen, Section } from "@/ui";

function Block({ b }: { b: StatBlock }) {
  const { c } = useTheme();
  return (
    <Card>
      <AppText variant="headline">{b.title}</AppText>
      {b.note ? (
        <AppText variant="caption" tone="muted">
          {b.note}
        </AppText>
      ) : null}
      {b.error ? <NoticeBox tone="warning" text={b.error} /> : null}
      {b.stats?.length ? (
        <View style={styles.grid}>
          {b.stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: c.background, borderColor: c.border }]}>
              <AppText variant="caption" tone="muted">
                {s.label}
              </AppText>
              <AppText variant="title">{s.value}</AppText>
              {s.sub ? (
                <AppText variant="caption" tone="muted">
                  {s.sub}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {b.bars?.length ? (
        <View style={{ gap: space.sm }}>
          {b.bars.map((x) => (
            <View key={x.label} style={{ gap: 2 }}>
              <View style={styles.between}>
                <AppText variant="callout" numberOfLines={1} style={{ flex: 1 }}>
                  {x.label}
                </AppText>
                <AppText variant="callout" tone="muted">
                  {x.text}
                </AppText>
              </View>
              <View style={[styles.track, { backgroundColor: c.border }]}>
                <View style={{ height: 8, width: `${Math.min(100, (x.value / (x.max || 1)) * 100)}%`, backgroundColor: x.value / (x.max || 1) > 0.85 ? c.danger : c.accent, borderRadius: 4 }} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {b.head && b.rows ? (
        <View style={{ gap: 4 }}>
          <View style={styles.between}>
            {b.head.map((h, i) => (
              <AppText key={h} variant="caption" tone="muted" style={i === 0 ? { flex: 1 } : styles.num}>
                {h}
              </AppText>
            ))}
          </View>
          {b.rows.length ? (
            b.rows.map((r, ri) => (
              <View key={ri} style={[styles.between, { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 }]}>
                {r.map((cell, i) => (
                  <AppText key={i} variant="callout" numberOfLines={2} style={i === 0 ? { flex: 1 } : styles.num}>
                    {cell}
                  </AppText>
                ))}
              </View>
            ))
          ) : (
            <AppText variant="callout" tone="muted">
              目前沒有資料
            </AppText>
          )}
        </View>
      ) : null}
    </Card>
  );
}

/** 一個統計來源的區塊：預設收起，點開才讀取；裡面最常用的在上面，進階的再收一層。 */
function Source({ title, from, path, advancedTitle }: { title: string; from: string; path: string; advancedTitle?: string }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { data, error, loading, reload } = useApi<MuxStats>(open ? path : null);
  const core = (data?.blocks ?? []).filter((b) => b.level === "core");
  const more = (data?.blocks ?? []).filter((b) => b.level === "more");
  const adv = (data?.blocks ?? []).filter((b) => b.level === "advanced");
  return (
    <View style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={[styles.toggle, { borderColor: c.border, backgroundColor: c.surface, minHeight: 64 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="caption" tone="muted">
            {from}
          </AppText>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={22} color={c.textMuted} />
      </Pressable>
      {open ? (
        <>
          <View style={styles.between}>
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              {data ? `更新時間 ${dateTime(data.generatedAt)}（${from}）` : from}
            </AppText>
            <Button variant="secondary" label="重新整理" icon="refresh-outline" onPress={reload} />
          </View>
          {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
          {loading && !data ? <LoadingView /> : null}
          {data ? (
            <>
              {core.map((b) => <Block key={b.id} b={b} />)}
              {more.map((b) => <Block key={b.id} b={b} />)}
              {adv.length ? (
                <>
                  <Pressable accessibilityRole="button" onPress={() => setShowAdvanced((v) => !v)} style={[styles.toggle, { borderColor: c.border, backgroundColor: c.surface }]}>
                    <AppText variant="headline" style={{ flex: 1 }}>
                      {advancedTitle ?? "進階統計"}
                    </AppText>
                    <Ionicons name={showAdvanced ? "chevron-up" : "chevron-down"} size={22} color={c.textMuted} />
                  </Pressable>
                  {showAdvanced ? adv.map((b) => <Block key={b.id} b={b} />) : null}
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** 統計分析：兩種來源分開顯示、互不混合（Mux 影片數據、本 App 資料庫），預設都收起；超級管理員、總部秘書與被指定的職務可以看。 */
export default function StatsScreen() {
  const { c } = useTheme();
  const { member } = useSession();
  const { config, reload: reloadCfg } = useUiConfig();
  const allowed = !!member?.canViewStats;
  const [roles, setRoles] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  if (!allowed) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="沒有查看統計分析的權限" /></Screen>;
  const isSuper = !!member?.titles.includes("超級管理員");
  const cur = roles ?? config.statsRoles;
  const saveRoles = async () => {
    try {
      await api("PUT", "/admin/ui-config", { statsRoles: cur });
      reloadCfg();
      setMsg({ tone: "success", text: "已儲存可查看的職務" });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };
  return (
    <Screen header={false}>
      <Source title="① Mux 影片統計" from="資料來自 Mux（影片服務）" path="/admin/stats/mux" advancedTitle="進階統計（裝置、瀏覽器、國家、播放錯誤、直播）" />
      <Source title="② App 資料庫統計" from="資料來自本 App 自己的資料庫（D1）" path="/admin/stats/app" />

      {isSuper ? (
        <Section title="誰可以看這一頁（超級管理員設定）">
          <Card>
            <AppText variant="callout" tone="muted">
              超級管理員與總部秘書一律可以看。也可以勾選其他有職務的會員（會出現在他們的「設定」頁）：
            </AppText>
            {STATS_ROLE_OPTIONS.map((o) => {
              const on = cur.includes(o.key);
              return (
                <Pressable key={o.key} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setRoles(on ? cur.filter((x) => x !== o.key) : [...cur, o.key])} style={styles.check}>
                  <Ionicons name={on ? "checkbox" : "square-outline"} size={28} color={on ? c.accent : c.textMuted} />
                  <AppText variant="body">{o.title}</AppText>
                </Pressable>
              );
            })}
            <Button label="儲存" icon="save-outline" onPress={saveRoles} />
            {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", gap: space.sm, justifyContent: "space-between" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  num: { minWidth: 70, textAlign: "right" },
  toggle: { flexDirection: "row", alignItems: "center", minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  check: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: minTouch },
});
