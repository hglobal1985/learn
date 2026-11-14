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
type Usage = { freeOnly: boolean; capEnabled: boolean; dailyCap: number; day: string; used: number; freeDaily: number; stopped: boolean; resumesAt: string; capChoices: number[] };
type KeyInfo = { key: string; label: string; ready: boolean; need: string; steps: string };
type Data = { jobs: Job[]; models: Model[]; selection: Record<string, string>; usage: Usage; keys: KeyInfo[] };
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
  const [usage, setUsage] = useState<Usage | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  if (!isSuper)
    return (
      <Screen header={false}>
        <EmptyState icon="lock-closed-outline" title="只有超級管理員可以設定 AI 模型" />
      </Screen>
    );
  const current = sel ?? data?.selection ?? {};
  const u = usage ?? data?.usage;
  const [testing, setTesting] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const testKey = async (k: KeyInfo) => {
    setTesting(k.key);
    setMsg(null);
    try {
      const r = await api<{ message: string; view: Data }>("POST", "/admin/ai-models/test", { target: k.key });
      setUsage(r.view.usage);
      setMsg({ tone: "success", text: r.message });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setTesting(null);
    }
  };
  const saveSettings = async (settings: Partial<Pick<Usage, "freeOnly" | "dailyCap" | "capEnabled">>, ok: string) => {
    setMsg(null);
    try {
      const r = await api<Data>("PUT", "/admin/ai-models", { settings });
      setUsage(r.usage);
      setSel(r.selection);
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };
  const resumeText = u ? `明天早上 8:00（台灣時間）自動恢復` : "";
  const choose = async (job: Job, id: string) => {
    if (current[job.key] === id) return;
    const before = current;
    setSel({ ...current, [job.key]: id });
    setMsg(null);
    try {
      const r = await api<Data>("PUT", "/admin/ai-models", { selection: { [job.key]: id } });
      setSel(r.selection);
      setUsage(r.usage);
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
          {u ? (
            <Section title="今日 AI 用量">
              <Card>
                <AppText variant="headline">
                  {u.used.toLocaleString()} ／ {u.dailyCap.toLocaleString()} 點{u.stopped ? "　已自動停止" : ""}
                </AppText>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: c.border, overflow: "hidden" }}>
                  <View style={{ height: 10, width: `${Math.min(100, (u.used / u.dailyCap) * 100)}%`, backgroundColor: u.stopped ? c.danger : c.accent }} />
                </View>
                <AppText variant="callout">限制在免費額度內（用完自動停止）</AppText>
                <View style={styles.chips}>
                  {([true, false] as const).map((v) => {
                    const on = u.capEnabled === v;
                    return (
                      <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => (on ? undefined : saveSettings({ capEnabled: v }, v ? "已開啟：用到上限就自動停止，隔天恢復" : "已關閉：不再自動停止"))} style={[styles.chip, { flex: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : "transparent" }]}>
                        <AppText variant="callout" style={{ fontWeight: on ? "700" : "400" }}>
                          {v ? "開（建議）" : "關"}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <AppText variant="caption" tone={u.capEnabled ? "muted" : undefined} style={u.capEnabled ? undefined : { color: c.danger }}>
                  {u.capEnabled
                    ? `Cloudflare 每天免費 ${u.freeDaily.toLocaleString()} 點，用到下方上限就自動停止所有 AI 工作，${resumeText}。`
                    : "已關閉：AI 不會自動停止。超過免費額度時，Cloudflare 免費方案會直接拒絕，付費方案會開始計費（每 1,000 點 US$0.011）。"}
                </AppText>
                <View style={{ opacity: u.capEnabled ? 1 : 0.45, gap: space.sm }} pointerEvents={u.capEnabled ? "auto" : "none"}>
                <AppText variant="callout">每天最多用（留一點緩衝，避免超過免費額度）</AppText>
                <View style={styles.chips}>
                  {u.capChoices.map((n) => {
                    const on = u.dailyCap === n;
                    return (
                      <Pressable key={n} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => (on ? undefined : saveSettings({ dailyCap: n }, `每天上限改為 ${n.toLocaleString()} 點`))} style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : "transparent" }]}>
                        <AppText variant="callout" style={{ fontWeight: on ? "700" : "400" }}>
                          {n.toLocaleString()}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                </View>
                <AppText variant="callout">只用免費模型（不用 Claude）</AppText>
                <View style={styles.chips}>
                  {([true, false] as const).map((v) => {
                    const on = u.freeOnly === v;
                    return (
                      <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => (on ? undefined : saveSettings({ freeOnly: v }, v ? "已改為只用免費模型" : "已允許使用付費模型"))} style={[styles.chip, { flex: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : "transparent" }]}>
                        <AppText variant="callout" style={{ fontWeight: on ? "700" : "400" }}>
                          {v ? "開（建議）" : "關"}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <AppText variant="caption" tone="muted">
                  開啟時，Claude 這類沒有免費額度的模型不能選用。用量是程式自己依模型換算的估計值，正確數字請看 Cloudflare 後台的 Workers AI 頁面。
                </AppText>
              </Card>
            </Section>
          ) : null}
          <Section title="AI 金鑰與連線">
            <Card>
              {data.keys.map((k) => (
                <View key={k.key} style={{ gap: space.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Ionicons name={k.ready ? "checkmark-circle" : "alert-circle-outline"} size={24} color={k.ready ? c.accent : c.danger} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="headline">{k.label}</AppText>
                      <AppText variant="caption" tone="muted">
                        {k.ready ? "已設定" : "尚未設定"}　{k.need}
                      </AppText>
                    </View>
                    <Pressable accessibilityRole="button" disabled={!k.ready || testing !== null} onPress={() => testKey(k)} style={[styles.chip, { borderColor: c.border, opacity: k.ready ? 1 : 0.45 }]}>
                      <AppText variant="callout">{testing === k.key ? "測試中…" : "測試連線"}</AppText>
                    </Pressable>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setOpen(open === k.key ? null : k.key)} style={{ minHeight: minTouch, justifyContent: "center" }}>
                    <AppText variant="callout" style={{ color: c.accent }}>
                      {open === k.key ? "收起設定步驟 ▴" : "設定步驟 ▾"}
                    </AppText>
                  </Pressable>
                  {open === k.key ? (
                    <AppText variant="caption" tone="muted">
                      {k.steps}
                    </AppText>
                  ) : null}
                </View>
              ))}
              <AppText variant="caption" tone="muted">
                金鑰一律由你在 Cloudflare 後台設定，這個頁面只會顯示「有沒有設定」，不會顯示或儲存金鑰內容。測試連線會用掉極少量額度。
              </AppText>
            </Card>
          </Section>
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
                    const locked = !!u?.freeOnly && m.needsKey;
                    return (
                      <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: locked }} disabled={locked} onPress={() => choose(job, m.id)} style={[styles.opt, { opacity: locked ? 0.45 : 1 }, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : "transparent" }]}>
                        <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={24} color={on ? c.accent : c.textMuted} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="headline">
                            {m.name}
                            {m.id === job.default ? "（預設）" : ""}
                          </AppText>
                          <AppText variant="caption" tone="muted">
                            花費：{m.costLevel}　{m.needsKey ? (locked ? "沒有免費額度（已鎖定）" : "需另外申請金鑰") : "不需金鑰"}
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
  chips: { flexDirection: "row", gap: space.sm },
  chip: { minHeight: minTouch, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: radius.md },
  cell: { padding: space.sm },
});
