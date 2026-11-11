import { useState } from "react";
import { View } from "react-native";
import { api, type CourseDetail, type CourseRun } from "@/api/client";
import { dateTime, ntd, parseLocal, toLocal } from "@/features/format";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, Field, NoticeBox, Pill, Section } from "@/ui";

type Form = { title: string; startsAt: string; location: string; registerUntil: string; capacity: string; priceTwd: string };
const blank: Form = { title: "", startsAt: "", location: "", registerUntil: "", capacity: "", priceTwd: "" };
const fromRun = (r: CourseRun): Form => ({ title: r.title, startsAt: toLocal(r.startsAt), location: r.location, registerUntil: toLocal(r.registerUntil), capacity: r.capacity ? String(r.capacity) : "", priceTwd: "" });

/** 管理員：場次（每場各自報名、繳費、審核）。 */
export function RunsEditor({ course, onChanged }: { course: CourseDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null); // run id 或 "new"
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setEditing(null);
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const startsAt = parseLocal(form.startsAt);
    const registerUntil = parseLocal(form.registerUntil);
    if (startsAt === undefined || registerUntil === undefined) return setMsg("日期格式請用 2026-12-01 19:30");
    const body = { title: form.title, startsAt, location: form.location, registerUntil, capacity: form.capacity.trim() || null, ...(form.priceTwd.trim() || editing === "new" ? { priceTwd: form.priceTwd.trim() || null } : {}) };
    return run(() => (editing === "new" ? api("POST", `/admin/courses/${course.id}/runs`, body) : api("PATCH", `/admin/runs/${editing}`, body)));
  };

  return (
    <Section title="場次" action={<Button variant="ghost" label="新增場次" icon="add" onPress={() => (setForm(blank), setEditing("new"))} />}>
      {!course.runs.length && editing !== "new" ? <NoticeBox text="沒有場次時，學員報名一次就開通整門課。定期舉辦的課程請新增場次，學員每一場各自報名、繳費。" /> : null}
      {msg ? <NoticeBox tone="danger" text={msg} /> : null}
      {course.runs.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
            <AppText variant="headline" style={{ flex: 1 }}>
              {r.title}
            </AppText>
            <Pill label={r.status === "closed" ? "已關閉報名" : r.open ? "報名中" : "已截止／額滿"} tone={r.open ? "success" : "neutral"} />
            <Pill label={r.free ? "免費" : r.priceTwd != null ? ntd(r.priceTwd) : ""} />
          </View>
          <AppText variant="callout" tone="muted">
            {[r.startsAt ? dateTime(r.startsAt) : "未定日期", r.location, r.registerUntil ? `報名至 ${dateTime(r.registerUntil)}` : "", r.capacity ? `名額 ${r.capacity}（剩 ${r.remaining}）` : "不限名額"].filter(Boolean).join(" · ")}
          </AppText>
          {editing === r.id ? null : (
            <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
              <Button variant="secondary" label="編輯" onPress={() => (setForm(fromRun(r)), setEditing(r.id))} />
              <Button variant="secondary" label={r.status === "closed" ? "重新開放報名" : "關閉報名"} disabled={busy} onPress={() => run(() => api("PATCH", `/admin/runs/${r.id}`, { status: r.status === "closed" ? "open" : "closed" }))} />
              <Button variant="danger" label="刪除" disabled={busy} onPress={() => run(() => api("DELETE", `/admin/runs/${r.id}`))} />
            </View>
          )}
        </Card>
      ))}
      {editing ? (
        <Card>
          <AppText variant="headline">{editing === "new" ? "新增場次" : "編輯場次"}</AppText>
          <Field label="場次名稱（必填）" value={form.title} onChange={set("title")} placeholder="例如：2026 年 12 月" />
          <Field label="上課時間" value={form.startsAt} onChange={set("startsAt")} placeholder="2026-12-01 19:30" />
          <Field label="地點或線上" value={form.location} onChange={set("location")} />
          <Field label="報名截止" value={form.registerUntil} onChange={set("registerUntil")} placeholder="2026-11-30 23:59" />
          <Field label="名額（空白＝不限）" value={form.capacity} onChange={set("capacity")} numeric />
          <Field label="本場費用（空白＝沿用課程費用）" value={form.priceTwd} onChange={set("priceTwd")} numeric />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label="儲存場次" loading={busy} disabled={!form.title.trim()} onPress={save} />
            <Button variant="ghost" label="取消" onPress={() => setEditing(null)} />
          </View>
        </Card>
      ) : null}
    </Section>
  );
}
