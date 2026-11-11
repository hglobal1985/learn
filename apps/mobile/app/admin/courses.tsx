import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, type CourseSummary, type Rank } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, LoadingView, NoticeBox, Pill, Screen } from "@/ui";

/** 管理員：設定每門課的最低獎銜與上下架。獎銜代碼與會員中心一致，會員是否符合由會員中心即時判斷。 */
export default function AdminCoursesScreen() {
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const isAdmin = member?.role === "admin";
  const courses = useApi<CourseSummary[]>(isAdmin ? "/admin/courses" : null);
  const ranks = useApi<Rank[]>("/ranks");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  if (!isAdmin) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  if (!courses.data || !ranks.data)
    return <Screen header={false}>{courses.error ? <ErrorView message={courses.error} onRetry={courses.reload} /> : <LoadingView />}</Screen>;

  const patch = async (course: CourseSummary, body: Record<string, string>, done: string) => {
    setBusy(course.id);
    setMessage(null);
    try {
      await api("PATCH", `/admin/courses/${course.id}`, body);
      setMessage({ tone: "success", text: `「${course.title}」${done}` });
      invalidate();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen header={false}>
      <NoticeBox text="獎銜選項與會員中心一致；會員是否符合由會員中心即時判斷。" />
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      {courses.data.map((course) => (
        <Card key={course.id}>
          <View style={styles.head}>
            <AppText variant="headline" style={{ flex: 1 }}>
              {course.title}
            </AppText>
            <Pill label={course.status === "published" ? "上架中" : "未上架"} tone={course.status === "published" ? "success" : "danger"} />
          </View>
          <View style={styles.head}>
            <AppText variant="callout" tone="muted">
              最低獎銜
            </AppText>
            <Pill label={course.minRank.name} tone="accent" />
            <Button variant="ghost" label={editing === course.id ? "收合" : "變更"} onPress={() => setEditing(editing === course.id ? null : course.id)} />
          </View>
          {editing === course.id ? (
          <View style={styles.chips} accessibilityLabel={`${course.title} 最低獎銜`}>
            {ranks.data!.map((r) => {
              const active = r.code === course.minRank.code;
              return (
                <Pressable
                  key={r.code}
                  disabled={busy === course.id || active}
                  onPress={() => patch(course, { minRankCode: r.code }, `最低獎銜已改為 ${r.name}`).then(() => setEditing(null))}
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
          <View style={styles.head}>
            <Button
              variant="secondary"
              label={course.status === "published" ? "下架" : "上架"}
              icon={course.status === "published" ? "eye-off-outline" : "eye-outline"}
              loading={busy === course.id}
              onPress={() =>
                patch(course, { status: course.status === "published" ? "draft" : "published" }, course.status === "published" ? "已下架" : "已上架")
              }
            />
            <Button variant="secondary" label="各堂影片" icon="videocam-outline" onPress={() => router.push(`/admin/course/${course.id}`)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
});
