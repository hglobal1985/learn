import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, type CourseSummary, type Rank } from "@/api/client";
import { CourseCard } from "@/features/courses/course-card";
import { sortCourses } from "@/features/courses/sort";
import { canManageCourses } from "@/lib/roles";
import { useApi, useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button, EmptyState, ErrorView, LoadingView, NoticeBox, Pill, Screen, Select } from "@/ui";

const ALL = "";

/**
 * 管理員的課程清單：呈現方式與「全部課程」完全一致（同樣的排序、分類與單位篩選、同樣的課程卡），
 * 每張卡下方多一排管理按鈕：上架／下架、編輯、章節與影片，以及最低獎銜。
 * 為了能選到每一個梯次，這裡不會把同系列的課合併成一張。
 */
export default function AdminCoursesScreen() {
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const { config } = useUiConfig();
  const isAdmin = canManageCourses(member);
  const courses = useApi<CourseSummary[]>(isAdmin ? "/admin/courses" : null);
  const ranks = useApi<Rank[]>("/ranks");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [category, setCategory] = useState(ALL);
  const [unit, setUnit] = useState(ALL);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  const sorted = useMemo(() => sortCourses(courses.data ?? [], member, config.sortGroups), [courses.data, member, config.sortGroups]);
  const categories = useMemo(() => [...new Set(sorted.flatMap((x) => x.category.split("、")).filter(Boolean))], [sorted]);
  const units = useMemo(() => [...new Set(sorted.flatMap((x) => [x.guidanceUnit, ...x.hostUnit.split("、")]).filter(Boolean))], [sorted]);
  const list = sorted.filter((x) => (category === ALL || x.category.split("、").includes(category)) && (unit === ALL || x.guidanceUnit === unit || x.hostUnit.split("、").includes(unit)));

  if (!isAdmin) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要課程管理權限" /></Screen>;
  if (!courses.data || !ranks.data)
    return <Screen header={false}>{courses.error ? <ErrorView message={courses.error} onRetry={courses.reload} /> : <LoadingView />}</Screen>;

  const patch = async (course: CourseSummary, body: Record<string, string>, done: string) => {
    setBusy(course.id);
    setMessage(null);
    try {
      await api("PATCH", `/admin/courses/${course.id}`, body);
      setMessage({ tone: "success", text: `「${course.title}」${done}` });
      invalidate();
      courses.reload();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const manage = (course: CourseSummary) => (
    <View style={styles.manage}>
      <View style={styles.head}>
        <AppText variant="callout" tone="muted">
          最低獎銜
        </AppText>
        <Pill label={course.minRank.name} tone="accent" />
        <Pill label={course.status === "published" ? "上架中" : "未上架"} tone={course.status === "published" ? "success" : "danger"} />
        <Button variant="ghost" label={editing === course.id ? "收合" : "變更獎銜"} onPress={() => setEditing(editing === course.id ? null : course.id)} />
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
          onPress={() => patch(course, { status: course.status === "published" ? "draft" : "published" }, course.status === "published" ? "已下架" : "已上架")}
        />
        <Button variant="secondary" label="編輯" icon="create-outline" onPress={() => router.push({ pathname: "/admin/course-edit", params: { id: course.id } })} />
        <Button variant="secondary" label="章節與影片" icon="videocam-outline" onPress={() => router.push(`/admin/course/${course.id}`)} />
      </View>
    </View>
  );

  return (
    <Screen header={false}>
      <Button label="新增課程" icon="add-circle-outline" onPress={() => router.push("/admin/course-edit")} fullWidth />
      <View style={styles.filters}>
        <Select label="分類" value={category} options={[{ key: ALL, label: "全部分類" }, ...categories.map((x) => ({ key: x, label: x }))]} onChange={setCategory} />
        {units.length ? <Select label="指導或主辦單位" value={unit} options={[{ key: ALL, label: "全部單位" }, ...units.map((u) => ({ key: u, label: u }))]} onChange={setUnit} /> : null}
      </View>
      <AppText variant="caption" tone="muted">
        共 {list.length} 門課程。點課程卡可以預覽課程頁；下方按鈕用來編輯、上下架、管理章節。
      </AppText>
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      {!list.length ? <EmptyState icon="library-outline" title="沒有符合條件的課程" /> : null}
      {list.map((course) => (
        <CourseCard key={course.id} course={course} footer={manage(course)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: space.sm },
  manage: { gap: space.sm },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
});
