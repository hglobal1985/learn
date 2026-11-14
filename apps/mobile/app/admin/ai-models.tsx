import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Card, EmptyState, ErrorView, LoadingView, NoticeBox, Screen, Section } from "@/ui";

type Kind = "speech" | "text" | "embedding";
type Model = { id: string; name: string; vendor: string; kind: Kind; cost: string; costLevel: "低" | "中" | "高"; strengths: string; bestFor: string; needsKey: boolean };
type Job = { key: string; label: string; desc: string; kind: Kind; default: string };
type Data = { jobs: Job[]; models: Model[]; selection: Record<string, string> };
const KIND_LABEL: Record<Kind, string> = { speech: "語音轉文字", text: "文字整理", embedding: "語意搜尋" };
const COLS = [
  { label: "模型", w: 150 },
  { label: "種類", w: 90 },
  { label: "花費", w: 190 },
  { label: "專長特性", w: 220 },
  { label: "適合用途", w: 200 },
] as const;

/** AI 模型（超級管理員）：選擇各項 AI 工作要用哪個模型，並附各模型的花費與特性總表。 */
export default function AiModelsScreen() {
  const { c } = useTheme();
  const { member } = useSession();
  const isSuper = !!member?.titles.includes("超級管理員");
  const { data, error, loading, reload } = useApi<Data>(isSuper ? "/admin/ai-models" : null);
  const [sel, setSel] = useState<Record<string, string> | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  if (!isSuper)
    return (
      <Screen header={false}>
        <EmptyState icon="lock-closed-outline" title="只有超級管理員可以設定 AI 模型" />
      </Screen>
    );
  const current = sel ?? data?.selection ?? {};
  const choose = async (job: Job, id: string) => {
    if (current[job.key] === id) return;
    const before = current;
    setSel({ ...current, [job.key]: id });
    setMsg(null);
    try {
      const r = await api<Data>("PUT", "/admin/ai-models", { selection: { [job.key]: id } });
      setSel(r.selection);
      const m = r.models.find((x) => x.id === id);
      setMsg({ tone: "success", text: `「${job.label}」已改用 ${m?.name ?? id}` });
    } catch (e) {
      setSel(before);
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };

  return (
    <Screen header={false}>
      <AppText variant="callout" tone="muted">
        替每一項 AI 工作選擇要用的模型，點一下就會儲存。下方總表可以比較各模型的花費與特性。
      </AppText>
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data ? (
        <>
          {data.jobs.map((job) => (
            <Section key={job.key} title={job.label}>
              <Card>
                <AppText variant="callout" tone="muted">
                  {job.desc}
                </AppText>
                {data.models
                  .filter((m) => m.kind === job.kind)
                  .map((m) => {
                    const on = current[job.key] === m.id;
                    return (
                      <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => choose(job, m.id)} style={[styles.opt, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : "transparent" }]}>
                        <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={24} color={on ? c.accent : c.textMuted} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="headline">
                            {m.name}
                            {m.id === job.default ? "（預設）" : ""}
                          </AppText>
                          <AppText variant="caption" tone="muted">
                            花費：{m.costLevel}　{m.needsKey ? "需另外申請金鑰" : "不需金鑰"}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
              </Card>
            </Section>
          ))}
          <Section title="AI 模型總表">
            <AppText variant="caption" tone="muted">
              花費為約略估計，實際以各家官方牌價為準；左右滑動可看完整表格。
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, overflow: "hidden" }}>
                <View style={[styles.row, { backgroundColor: c.accentSoft }]}>
                  {COLS.map((col) => (
                    <AppText key={col.label} variant="callout" style={[styles.cell, { width: col.w, fontWeight: "700" }]}>
                      {col.label}
                    </AppText>
                  ))}
                </View>
                {data.models.map((m) => {
                  const cells = [`${m.name}\n${m.vendor}`, KIND_LABEL[m.kind], `【${m.costLevel}】${m.cost}${m.needsKey ? "\n需另外申請金鑰" : ""}`, m.strengths, m.bestFor];
                  return (
                    <View key={m.id} style={[styles.row, { borderTopWidth: 1, borderTopColor: c.border }]}>
                      {cells.map((t, i) => (
                        <AppText key={i} variant="caption" style={[styles.cell, { width: COLS[i]!.w }]}>
                          {t}
                        </AppText>
                      ))}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: minTouch + 8, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderRadius: radius.md },
  row: { flexDirection: "row" },
  cell: { padding: space.sm },
});
