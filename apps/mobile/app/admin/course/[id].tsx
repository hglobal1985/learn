import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, type CourseDetail, type Lesson, type MediaType } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, LoadingView, NoticeBox, Pill, Screen } from "@/ui";

const kinds: { key: MediaType; label: string; hint: string }[] = [
  { key: "demo", label: "示範短片", hint: "" },
  { key: "youtube", label: "YouTube", hint: "貼上 YouTube 影片網址（建議設為「不公開」）" },
  { key: "mux", label: "Mux", hint: "" },
];

/** 管理員：設定每一堂課的影片來源。學員只會拿到後端授權後的播放資訊。 */
export default function LessonMediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, invalidate } = useSession();
  const isAdmin = member?.role === "admin";
  const course = useApi<CourseDetail>(isAdmin ? `/courses/${id}` : null);
  if (!isAdmin) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  if (!course.data) return <Screen header={false}>{course.error ? <ErrorView message={course.error} onRetry={course.reload} /> : <LoadingView />}</Screen>;
  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: course.data.title }} />
      <NoticeBox text="Mux：點「從 Mux 選擇影片」直接挑選，會自動帶入影片與長度。YouTube 影片任何拿到網址的人都能看，需要保護的課程請用 Mux。" />
      {course.data.lessons.map((l) => (
        <LessonEditor key={`${l.id}:${l.media?.type}:${l.media?.ref}:${l.minutes}`} lesson={l} onSaved={invalidate} />
      ))}
    </Screen>
  );
}

function LessonEditor({ lesson, onSaved }: { lesson: Lesson; onSaved: () => void }) {
  const { c } = useTheme();
  const [kind, setKind] = useState<MediaType>(lesson.media?.type ?? "demo");
  const [ref, setRef] = useState(lesson.media?.ref ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ mediaRef: string | null }>("PATCH", `/admin/lessons/${lesson.id}`, { mediaType: kind, mediaRef: ref });
      setRef(r.mediaRef ?? "");
      setMsg({ tone: "success", text: "已儲存" });
      onSaved();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const hint = kinds.find((k) => k.key === kind)!.hint;
  return (
    <Card>
      <View style={styles.row}>
        <AppText variant="headline" style={{ flex: 1 }}>
          {lesson.position}. {lesson.title}
        </AppText>
        <Pill label={kinds.find((k) => k.key === (lesson.media?.type ?? "demo"))!.label} />
      </View>
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
      {kind === "mux" ? (
        <View style={{ gap: space.sm }}>
          {lesson.media?.type === "mux" && lesson.media.ref ? (
            <AppText variant="callout" tone="muted">
              目前影片：{lesson.media.ref.slice(0, 8)}…（{lesson.minutes} 分鐘）
            </AppText>
          ) : null}
          <Button
            label={lesson.media?.type === "mux" ? "更換 Mux 影片" : "從 Mux 選擇影片"}
            icon="cloud-download-outline"
            onPress={() => router.push({ pathname: "/admin/mux-picker", params: { lessonId: lesson.id, lessonTitle: lesson.title } })}
          />
        </View>
      ) : null}
      {kind === "youtube" ? (
        <TextInput
          value={ref}
          onChangeText={setRef}
          placeholder={hint}
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={`${lesson.title} 影片來源`}
          style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
        />
      ) : null}
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      {kind !== "mux" ? (
        <View style={styles.row}>
          <Button variant="secondary" label="儲存" icon="save-outline" loading={busy} onPress={save} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  input: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
});
