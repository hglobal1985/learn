import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ACHIEVEMENT_TYPES, api, type AchievementType, type AdminAchievement, type CourseSummary } from "@/api/client";
import { confirmAsk } from "@/features/confirm";
import { BADGE_ICONS, conditionText } from "@/features/achievements/text";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, Field, LoadingView, NoticeBox, Pill, Screen, Section, Select } from "@/ui";

type Form = { id: string | null; name: string; description: string; icon: string; type: AchievementType; threshold: string; courseId: string; active: boolean };
const blank: Form = { id: null, name: "", description: "", icon: "🏅", type: "lessons_completed", threshold: "10", courseId: "", active: true };

/** 超級管理員：設定學習成就徽章（名稱、圖示、要達成什麼條件）。會員達成後自動取得並收到通知。 */
export default function AdminAchievementsScreen() {
  const { member } = useSession();
  const isSuper = !!member?.titles.includes("超級管理員");
  const list = useApi<AdminAchievement[]>(isSuper ? "/admin/achievements" : null);
  const courses = useApi<CourseSummary[]>(isSuper ? "/admin/courses" : null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  if (!isSuper) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="只有超級管理員可以設定" /></Screen>;
  if (!list.data) return <Screen header={false}>{list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : <LoadingView />}</Screen>;

  const needsCourse = !!ACHIEVEMENT_TYPES[form?.type ?? "lessons_completed"].needsCourse;
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "success", text: done });
      list.reload();
      return true;
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!form) return;
    const body = { name: form.name, description: form.description, icon: form.icon, type: form.type, threshold: needsCourse ? 1 : Number(form.threshold), courseId: needsCourse ? form.courseId || null : null, active: form.active };
    const ok = await run(() => (form.id ? api("PATCH", `/admin/achievements/${form.id}`, body) : api("POST", "/admin/achievements", body)), form.id ? "已儲存" : "已新增徽章");
    if (ok) setForm(null);
  };
  const edit = (a: AdminAchievement) => setForm({ id: a.id, name: a.name, description: a.description, icon: a.icon, type: a.type, threshold: String(a.threshold), courseId: a.courseId ?? "", active: a.active });

  return (
    <Screen header={false}>
      <AppText variant="callout" tone="muted">
        會員達成條件就會自動獲得徽章並收到通知；進度從學習紀錄即時計算。停用的徽章不會顯示給會員。
      </AppText>
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      {!form ? <Button label="新增徽章" icon="add-circle-outline" onPress={() => setForm({ ...blank })} fullWidth /> : null}

      {form ? (
        <Section title={form.id ? "修改徽章" : "新增徽章"}>
          <Card>
            <Field label="徽章名稱" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例如：學習達人" />
            <Field label="說明（會顯示在徽章上）" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="例如：累計完成 50 堂課" />
            <Select label="徽章圖示" value={form.icon} options={BADGE_ICONS.map((i) => ({ key: i, label: i }))} onChange={(v) => setForm({ ...form, icon: v })} />
            <Select
              label="達成條件"
              value={form.type}
              options={(Object.keys(ACHIEVEMENT_TYPES) as AchievementType[]).map((t) => ({ key: t, label: ACHIEVEMENT_TYPES[t].label }))}
              onChange={(v) => setForm({ ...form, type: v as AchievementType })}
            />
            {needsCourse ? (
              <Select label="要學完的課程" value={form.courseId} options={[{ key: "", label: "請選擇課程" }, ...(courses.data ?? []).map((c) => ({ key: c.id, label: c.title }))]} onChange={(v) => setForm({ ...form, courseId: v })} />
            ) : (
              <Field label={`達成數量（${ACHIEVEMENT_TYPES[form.type].unit}）`} value={form.threshold} onChange={(v) => setForm({ ...form, threshold: v.replace(/\D/g, "") })} numeric />
            )}
            <Select label="狀態" value={form.active ? "on" : "off"} options={[{ key: "on", label: "啟用（會員看得到）" }, { key: "off", label: "停用（暫時隱藏）" }]} onChange={(v) => setForm({ ...form, active: v === "on" })} />
            <View style={styles.row}>
              <Button label="儲存" icon="save-outline" loading={busy} disabled={busy || !form.name.trim()} onPress={save} />
              <Button variant="ghost" label="取消" disabled={busy} onPress={() => setForm(null)} />
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title={`徽章清單（${list.data.length}）`}>
        {list.data.map((a) => (
          <Card key={a.id}>
            <View style={styles.row}>
              <AppText style={{ fontSize: 34, lineHeight: 42 }}>{a.icon}</AppText>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="headline">{a.name}</AppText>
                <AppText variant="callout" tone="muted">
                  {conditionText(a.type, a.threshold, a.courseTitle)}
                </AppText>
              </View>
              <Pill label={a.active ? "啟用" : "停用"} tone={a.active ? "success" : "neutral"} />
            </View>
            {a.description ? <AppText variant="caption" tone="muted">{a.description}</AppText> : null}
            <AppText variant="caption" tone="muted">
              已有 {a.earnedCount} 位會員取得
            </AppText>
            <View style={styles.row}>
              <Button variant="secondary" label="修改" icon="create-outline" disabled={busy} onPress={() => edit(a)} />
              <Button variant="secondary" label={a.active ? "停用" : "啟用"} disabled={busy} onPress={() => run(() => api("PATCH", `/admin/achievements/${a.id}`, { active: !a.active }), a.active ? "已停用" : "已啟用")} />
              <Button
                variant="danger"
                label="刪除"
                icon="trash-outline"
                disabled={busy}
                onPress={async () => (await confirmAsk("刪除徽章", `確定刪除「${a.name}」？已取得這枚徽章的會員紀錄也會一併刪除。`)) && run(() => api("DELETE", `/admin/achievements/${a.id}`), "已刪除")}
              />
            </View>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm } });
