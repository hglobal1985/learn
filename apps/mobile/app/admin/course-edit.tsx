import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, type CourseDetail, type Rank } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { courseThemes, minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, CourseCover, EmptyState, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

type Form = { title: string; subtitle: string; teacher: string; category: string; priceTwd: string; minRankCode: string; theme: string; description: string };
const empty: Form = { title: "", subtitle: "", teacher: "", category: "", priceTwd: "0", minRankCode: "none", theme: "sage", description: "" };

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((r) => Alert.alert(title, message, [{ text: "取消", style: "cancel", onPress: () => r(false) }, { text: "確定", style: "destructive", onPress: () => r(true) }]));
}

/** 管理員：新增或修改課程（沒有 id 參數時為新增）。 */
export default function CourseEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const isAdmin = member?.role === "admin";
  const course = useApi<CourseDetail>(isAdmin && id ? `/courses/${id}` : null);
  const ranks = useApi<Rank[]>("/ranks");
  const [form, setForm] = useState<Form>(empty);
  const [rankOpen, setRankOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    const d = course.data;
    if (d)
      setForm({
        title: d.title,
        subtitle: d.subtitle,
        teacher: d.teacher,
        category: d.category,
        priceTwd: String(d.priceTwd ?? 0),
        minRankCode: d.minRank.code,
        theme: d.theme,
        description: d.description ?? "",
      });
  }, [course.data]);

  if (!isAdmin) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  if (id && !course.data) return <Screen header={false}>{course.error ? <NoticeBox tone="danger" text={course.error} /> : <LoadingView />}</Screen>;

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const price = Number(form.priceTwd);
  const save = async (status?: "draft" | "published") => {
    setBusy(status ?? "save");
    setMsg(null);
    try {
      const body = { ...form, priceTwd: Number.isFinite(price) ? Math.round(price) : form.priceTwd, ...(status ? { status } : {}) };
      const d = id ? await api<CourseDetail>("PATCH", `/admin/courses/${id}`, body) : await api<CourseDetail>("POST", "/admin/courses", body);
      invalidate();
      if (!id) {
        router.replace({ pathname: "/admin/course/[id]", params: { id: d.id } });
        return;
      }
      setMsg({ tone: "success", text: status === "published" ? "已儲存並上架" : status === "draft" ? "已儲存並下架" : "已儲存" });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!id || !(await confirm("刪除課程", `確定刪除「${form.title}」？章節與音檔會一併刪除，無法復原。`))) return;
    setBusy("delete");
    try {
      await api("DELETE", `/admin/courses/${id}`);
      invalidate();
      router.replace("/admin/courses");
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
      setBusy(null);
    }
  };

  const field = (label: string, k: keyof Form, opts: { placeholder?: string; multiline?: boolean; numeric?: boolean } = {}) => (
    <View style={{ gap: space.xs }}>
      <AppText variant="callout" tone="muted">
        {label}
      </AppText>
      <TextInput
        value={form[k]}
        onChangeText={set(k)}
        placeholder={opts.placeholder}
        placeholderTextColor={c.textMuted}
        multiline={opts.multiline}
        keyboardType={opts.numeric ? "number-pad" : "default"}
        accessibilityLabel={label}
        style={[styles.input, type.body, opts.multiline && styles.multiline, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
      />
    </View>
  );
  const rank = ranks.data?.find((r) => r.code === form.minRankCode);

  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: id ? "編輯課程" : "新增課程" }} />
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      <CourseCover theme={form.theme} label={form.category || "分類"} />
      <Card>
        {field("課程名稱（必填）", "title", { placeholder: "例如：翡翠達標班" })}
        {field("副標題", "subtitle", { placeholder: "一句話說明這門課" })}
        {field("講師／主辦", "teacher", { placeholder: "例如：寰宇總部" })}
        {field("分類", "category", { placeholder: "例如：系列課程" })}
        {field("報名費用（新台幣，0 為免費）", "priceTwd", { numeric: true })}
        {price === 0 ? <Pill label="免費課程：報名後立即開通" tone="accent" /> : <Pill label="付費課程：報名後需審核繳費才開通" tone="warning" />}
        {field("課程介紹", "description", { multiline: true, placeholder: "課程內容、上課時間、適合對象……" })}
      </Card>

      <Section title="報名資格">
        <Card>
          <View style={styles.row}>
            <AppText variant="callout" tone="muted">
              最低獎銜
            </AppText>
            <Pill label={rank?.name ?? form.minRankCode} tone="accent" />
            <Button variant="ghost" label={rankOpen ? "收合" : "變更"} onPress={() => setRankOpen(!rankOpen)} />
          </View>
          {rankOpen ? (
            <View style={styles.chips}>
              {(ranks.data ?? []).map((r) => {
                const active = r.code === form.minRankCode;
                return (
                  <Pressable
                    key={r.code}
                    onPress={() => (set("minRankCode")(r.code), setRankOpen(false))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
                  >
                    <AppText variant="callout" style={{ color: active ? c.textOnAccent : c.text, fontWeight: "600" }}>
                      {r.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="封面顏色">
        <View style={styles.chips}>
          {Object.keys(courseThemes).map((t) => (
            <Pressable
              key={t}
              onPress={() => set("theme")(t)}
              accessibilityRole="button"
              accessibilityLabel={`封面顏色 ${t}`}
              accessibilityState={{ selected: form.theme === t }}
              style={[styles.swatch, { borderColor: form.theme === t ? c.text : "transparent" }]}
            >
              <View style={[styles.swatchInner, { backgroundColor: courseThemes[t].light[1] }]} />
            </Pressable>
          ))}
        </View>
      </Section>

      <View style={{ gap: space.sm }}>
        <Button label={id ? "儲存" : "建立課程（先不上架）"} icon="save-outline" loading={busy === "save"} disabled={!!busy} onPress={() => save()} fullWidth />
        {id && course.data?.status !== "published" ? (
          <Button variant="secondary" label="儲存並上架" icon="eye-outline" loading={busy === "published"} disabled={!!busy} onPress={() => save("published")} fullWidth />
        ) : null}
        {id && course.data?.status === "published" ? (
          <Button variant="secondary" label="下架" icon="eye-off-outline" loading={busy === "draft"} disabled={!!busy} onPress={() => save("draft")} fullWidth />
        ) : null}
        {id ? <Button variant="secondary" label="章節與影片" icon="list-outline" onPress={() => router.push({ pathname: "/admin/course/[id]", params: { id } })} fullWidth /> : null}
        {id ? <Button variant="danger" label="刪除課程" icon="trash-outline" loading={busy === "delete"} disabled={!!busy} onPress={remove} fullWidth /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  multiline: { minHeight: 120, paddingTop: space.md, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  swatch: { width: minTouch, height: minTouch, borderRadius: minTouch / 2, borderWidth: 2, padding: 4 },
  swatchInner: { flex: 1, borderRadius: minTouch / 2 },
});
