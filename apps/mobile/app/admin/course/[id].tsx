import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, type CourseDetail, type Lesson, type MediaType } from "@/api/client";
import { pickAndUploadAudio } from "@/features/admin/audio-upload";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, Icon, LoadingView, NoticeBox, Pill, Screen } from "@/ui";

const kinds: { key: MediaType; label: string }[] = [
  { key: "demo", label: "示範短片" },
  { key: "youtube", label: "YouTube" },
  { key: "mux", label: "Mux" },
  { key: "audio", label: "音檔" },
];

type Hms = { h: string; m: string; s: string };
const toHms = (sec: number | null): Hms =>
  sec == null ? { h: "", m: "", s: "" } : { h: String(Math.floor(sec / 3600)), m: String(Math.floor((sec % 3600) / 60)), s: String(sec % 60) };
const fromHms = ({ h, m, s }: Hms): number | null | "invalid" => {
  if (!h.trim() && !m.trim() && !s.trim()) return null;
  const [a, b, c] = [h, m, s].map((x) => (x.trim() ? Number(x) : 0));
  if (![a, b, c].every((n) => Number.isInteger(n) && n >= 0) || b > 59 || c > 59) return "invalid";
  return a * 3600 + b * 60 + c;
};
const formatDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h} 小時 ${m} 分 ${s} 秒` : `${m} 分 ${s} 秒`;
};

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((r) => Alert.alert(title, message, [{ text: "取消", style: "cancel", onPress: () => r(false) }, { text: "確定", style: "destructive", onPress: () => r(true) }]));
}

/** 管理員：章節管理（新增、改名、排序、刪除）與每堂的影片／音檔、時間軸區間。 */
export default function LessonManagerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const isAdmin = member?.role === "admin";
  const course = useApi<CourseDetail>(isAdmin ? `/courses/${id}` : null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!isAdmin) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  if (!course.data) return <Screen header={false}>{course.error ? <ErrorView message={course.error} onRetry={course.reload} /> : <LoadingView />}</Screen>;
  const lessons = course.data.lessons;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      invalidate();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const move = (from: number, to: number) => {
    const ids = lessons.map((l) => l.id);
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    return run(() => api("POST", `/admin/courses/${id}/lessons/order`, { ids }));
  };

  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: course.data.title }} />
      <View style={styles.row}>
        <Button variant="secondary" label="課程資料" icon="create-outline" onPress={() => router.push({ pathname: "/admin/course-edit", params: { id } })} />
        <Pill label={course.data.status === "published" ? "上架中" : "未上架"} tone={course.data.status === "published" ? "success" : "danger"} />
      </View>
      <NoticeBox text="同一支影片可以切成多堂：每堂選同一支影片，再填各自的「開始／結束」時間，學員點選章節就會跳到該段，播到結束時間自動停止。" />
      {msg ? <NoticeBox tone="danger" text={msg} /> : null}
      {lessons.map((l, i) => (
        <LessonEditor
          key={`${l.id}:${l.media?.type}:${l.media?.ref}:${l.start}:${l.end}:${l.title}:${l.minutes}`}
          lesson={l}
          onSaved={invalidate}
          onUp={i > 0 ? () => move(i, i - 1) : undefined}
          onDown={i < lessons.length - 1 ? () => move(i, i + 1) : undefined}
          onDelete={async () => {
            if (await confirm("刪除章節", `確定刪除「${l.title}」？`)) await run(() => api("DELETE", `/admin/lessons/${l.id}`));
          }}
          disabled={busy}
        />
      ))}
      <Card>
        <AppText variant="headline">新增章節</AppText>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="章節名稱，例如：第 2 段 Q&A"
          placeholderTextColor={c.textMuted}
          accessibilityLabel="新章節名稱"
          style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
        />
        <Button
          label="新增章節"
          icon="add"
          loading={busy}
          disabled={!newTitle.trim()}
          onPress={() => run(() => api("POST", `/admin/courses/${id}/lessons`, { title: newTitle })).then(() => setNewTitle(""))}
        />
      </Card>
    </Screen>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: Hms; onChange: (v: Hms) => void }) {
  const { c } = useTheme();
  const box = (k: keyof Hms, unit: string) => (
    <View style={styles.timeCell}>
      <TextInput
        value={value[k]}
        onChangeText={(t) => onChange({ ...value, [k]: t.replace(/\D/g, "").slice(0, 2) })}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={c.textMuted}
        accessibilityLabel={`${label}${unit}`}
        style={[styles.timeInput, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
      />
      <AppText variant="callout" tone="muted">
        {unit}
      </AppText>
    </View>
  );
  return (
    <View style={styles.timeRow}>
      <AppText variant="callout" style={{ width: 36 }}>
        {label}
      </AppText>
      {box("h", "時")}
      {box("m", "分")}
      {box("s", "秒")}
    </View>
  );
}

function LessonEditor({
  lesson,
  onSaved,
  onUp,
  onDown,
  onDelete,
  disabled,
}: {
  lesson: Lesson;
  onSaved: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const { c } = useTheme();
  const [title, setTitle] = useState(lesson.title);
  const [kind, setKind] = useState<MediaType>(lesson.media?.type ?? "demo");
  const [ref, setRef] = useState(lesson.media?.type === "youtube" ? lesson.media.ref ?? "" : "");
  const [start, setStart] = useState(toHms(lesson.start));
  const [end, setEnd] = useState(toHms(lesson.end));
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  const s = fromHms(start);
  const e = fromHms(end);
  const rangeError = s === "invalid" || e === "invalid" ? "時間格式不正確（分、秒需在 0～59）" : e != null && (s ?? 0) >= e ? "結束時間必須晚於開始時間" : null;
  const length = !rangeError && e != null ? (e as number) - ((s as number | null) ?? 0) : null;
  const currentKind = lesson.media?.type ?? "demo";

  const save = async () => {
    if (rangeError) return setMsg({ tone: "danger", text: rangeError });
    setBusy("save");
    setMsg(null);
    try {
      const body: Record<string, unknown> = { title, startSeconds: s, endSeconds: e };
      if (kind === "demo" || kind === "youtube") body.mediaType = kind;
      if (kind === "youtube") body.mediaRef = ref;
      await api("PATCH", `/admin/lessons/${lesson.id}`, body);
      setMsg({ tone: "success", text: "已儲存" });
      onSaved();
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const upload = async () => {
    setBusy("upload");
    setMsg(null);
    try {
      const r = await pickAndUploadAudio(lesson.id, setProgress);
      if (r === "done") {
        setMsg({ tone: "success", text: "音檔已上傳" });
        onSaved();
      }
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };
  const check = async () => {
    setBusy("check");
    try {
      const r = await api<{ ok: boolean; message: string }>("GET", `/admin/lessons/${lesson.id}/check`);
      setMsg({ tone: r.ok ? "success" : "danger", text: r.message });
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <View style={styles.row}>
        <AppText variant="headline" style={{ flex: 1 }}>
          第 {lesson.position} 堂
        </AppText>
        <Pill label={kinds.find((k) => k.key === currentKind)!.label} />
        <IconButton icon="arrow-up" label="上移" onPress={onUp} disabled={disabled} />
        <IconButton icon="arrow-down" label="下移" onPress={onDown} disabled={disabled} />
        <IconButton icon="trash-outline" label="刪除章節" onPress={onDelete} disabled={disabled} danger />
      </View>
      <TextInput
        value={title}
        onChangeText={setTitle}
        accessibilityLabel={`第 ${lesson.position} 堂名稱`}
        style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
      />
      <View style={styles.row}>
        {kinds.map((k) => {
          const active = k.key === kind;
          return (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
            >
              <AppText variant="callout" style={{ color: active ? c.textOnAccent : c.text, fontWeight: "600" }}>
                {k.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {kind === "youtube" ? (
        <TextInput
          value={ref}
          onChangeText={setRef}
          placeholder="貼上 YouTube 影片網址（建議設為「不公開」）"
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={`${lesson.title} YouTube 網址`}
          style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
        />
      ) : null}
      {kind === "mux" ? (
        <View style={{ gap: space.sm }}>
          {currentKind === "mux" && lesson.media?.ref ? (
            <AppText variant="callout" tone="muted">
              目前影片：{lesson.media.ref.slice(0, 8)}…
            </AppText>
          ) : null}
          <Button
            variant="secondary"
            label={currentKind === "mux" ? "更換 Mux 影片" : "從 Mux 選擇影片"}
            icon="cloud-download-outline"
            onPress={() => router.push({ pathname: "/admin/mux-picker", params: { lessonId: lesson.id, lessonTitle: lesson.title } })}
          />
        </View>
      ) : null}
      {kind === "audio" ? (
        <View style={{ gap: space.sm }}>
          {currentKind === "audio" ? (
            <AppText variant="callout" tone="muted">
              目前已有音檔（{lesson.minutes} 分鐘）
            </AppText>
          ) : null}
          <Button
            variant="secondary"
            label={progress != null ? `上傳中 ${Math.round(progress * 100)}%` : currentKind === "audio" ? "更換音檔" : "上傳音檔"}
            icon="musical-notes-outline"
            loading={busy === "upload" && progress == null}
            disabled={!!busy}
            onPress={upload}
          />
        </View>
      ) : null}

      <AppText variant="callout" tone="muted">
        時間軸區間（選填；空白＝從頭播到結束）
      </AppText>
      <TimeInput label="開始" value={start} onChange={setStart} />
      <TimeInput label="結束" value={end} onChange={setEnd} />
      {rangeError ? (
        <AppText variant="callout" tone="danger">
          {rangeError}
        </AppText>
      ) : length != null ? (
        <AppText variant="callout" tone="accent">
          本堂長度：{formatDuration(length)}
        </AppText>
      ) : null}
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      <View style={styles.row}>
        <Button label="儲存" icon="save-outline" loading={busy === "save"} disabled={!!busy} onPress={save} />
        {currentKind === "mux" || currentKind === "audio" ? (
          <Button variant="secondary" label="播放檢查" icon="pulse-outline" loading={busy === "check"} disabled={!!busy} onPress={check} />
        ) : null}
      </View>
    </Card>
  );
}

function IconButton({ icon, label, onPress, disabled, danger }: { icon: "arrow-up" | "arrow-down" | "trash-outline"; label: string; onPress?: () => void; disabled?: boolean; danger?: boolean }) {
  const { c } = useTheme();
  const off = disabled || !onPress;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} style={[styles.iconBtn, { borderColor: c.border, opacity: off ? 0.35 : 1 }]}>
      <Icon name={icon} size={18} color={danger ? c.danger : c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  input: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  timeRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  timeCell: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeInput: { width: 56, minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, textAlign: "center" },
  iconBtn: { width: minTouch - 4, height: minTouch - 4, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
