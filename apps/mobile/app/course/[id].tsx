import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, StyleSheet, View } from "react-native";
import { api, type CourseDetail, type CourseRun, type Order } from "@/api/client";
import { CommentBoard } from "@/features/comments/comment-board";
import { confirmSheet } from "@/features/confirm";
import { EdmStage } from "@/features/courses/edm-viewer";
import { dateTime, eventDays, ntd } from "@/features/format";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, ErrorView, ListRow, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

const isWeb = Platform.OS === "web";

/**
 * 課程介紹頁：上方只有 EDM（與上課頁影片區同高、可上下拖曳、點一下放大），下面不再放任何課程說明文字，
 * 只有報名按鈕（依狀態）、場次與課程章節。標題在上方導覽列。
 */
export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, ready, invalidate } = useSession();
  const { data: course, error, loading, reload } = useApi<CourseDetail>(`/courses/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  // 課程介紹頁需登入：未登入導向登入，完成後回到這一頁。「完全公開」的課程例外，訪客直接看得到。
  if (ready && !member && !course && !loading) return <Redirect href={{ pathname: "/me", params: { next: `/course/${id}` } }} />;
  if (!course)
    return (
      <Screen header={false}>
        {loading || !ready ? <LoadingView /> : <ErrorView message={error ?? "找不到這門課程"} onRetry={reload} />}
      </Screen>
    );

  /** 報名：免費立即開通；付費建立待審核的報名並前往報名明細。 */
  const register = async (run?: CourseRun) => {
    setBusy(run?.id ?? "course");
    setMessage(null);
    try {
      const [order] = await api<Order[]>("POST", "/orders", { items: [{ courseId: course.id, runId: run?.id ?? "" }] });
      invalidate();
      if (order.status === "opened") setMessage({ tone: "success", text: "報名成功！課程已開通，請從下方章節開始上課。" });
      else router.push(`/orders/${order.id}`);
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  /** 反悔取消報名（只有「審核中」可以；已開通的不提供）。要先從下方彈出確認面板確認。 */
  const cancel = async (run?: CourseRun) => {
    if (!(await confirmSheet({ title: "取消報名", message: "確定要取消這筆報名嗎？取消後可以重新報名。", confirmLabel: "確定取消", cancelLabel: "先不要", danger: true }))) return;
    setBusy(`cancel-${run?.id ?? "course"}`);
    setMessage(null);
    try {
      await api("POST", `/courses/${course.id}/cancel-registration`, { runId: run?.id ?? "" });
      invalidate();
      setMessage({ tone: "success", text: "已取消報名。" });
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const registerButton = (free: boolean, key: string, run?: CourseRun) => {
    if (course.priceTba) return <NoticeBox tone="warning" text="這門課程的費用尚未公布，公布後才開放報名。" />;
    if (!member) return <Button label="登入後報名" icon="log-in-outline" onPress={() => router.push({ pathname: "/me", params: { next: `/course/${course.id}` } })} fullWidth />;
    if (!course.eligible) return <NoticeBox tone="warning" text={`這門課程限 ${course.minRank.name} 以上獎銜${course.allowPresident ? "或會長" : ""}報名。`} />;
    if (free) return <Button label="免費報名" icon="gift-outline" loading={busy === key} disabled={!!busy} onPress={() => register(run)} fullWidth />;
    // iOS/Android：依商店規範不顯示付費報名方式，只說明尚未開通。
    if (!isWeb) return <NoticeBox text="這門課程尚未為你開通。開通後即可在這裡觀看。" />;
    return <Button label="報名（送出後由窗口審核繳費）" icon="create-outline" loading={busy === key} disabled={!!busy} onPress={() => register(run)} fullWidth />;
  };

  /** 審核中：同一列兩顆按鈕——「付款審核中（點擊查看）」與「取消」。 */
  const pendingRow = (run?: CourseRun) => (
    <View style={styles.pending}>
      <View style={{ flex: 1 }}>
        <Button variant="secondary" label="付款審核中（點擊查看）" icon="time-outline" onPress={() => router.push("/orders")} fullWidth />
      </View>
      <Button variant="danger" label="取消" loading={busy === `cancel-${run?.id ?? "course"}`} disabled={!!busy} onPress={() => cancel(run)} />
    </View>
  );

  // 還不能看（尚未報名、不符資格…）：整個章節區蓋一層灰色遮罩加大鎖頭，章節完全不能點。
  const allLocked = course.lessons.length > 0 && course.lessons.every((l) => l.locked);
  const lockedText = course.priceTba ? "費用尚未公布，暫不開放" : member && !course.eligible ? "獎銜不符，目前無法報名" : "報名後才能觀看";

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: course.title }} />
      <EdmStage course={course} />
      <Screen header={false}>
        {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}

        {course.hasRuns ? (
          <Section title="場次">
            {course.runs.map((run) => (
              <Card key={run.id}>
                <View style={styles.row}>
                  <AppText variant="headline" style={{ flex: 1 }}>
                    {run.title}
                  </AppText>
                  {run.enrollment === "opened" ? <Pill label="已開通" tone="success" /> : run.enrollment === "pending" ? <Pill label="審核中" tone="warning" /> : !run.open ? <Pill label="報名已截止" /> : run.free ? <Pill label="免費" tone="accent" /> : run.priceTwd != null ? <Pill label={ntd(run.priceTwd)} /> : null}
                </View>
                <AppText variant="callout" tone="muted">
                  {[run.startsAt ? dateTime(run.startsAt) : "", run.location, run.registerUntil ? `報名至 ${dateTime(run.registerUntil)}` : "", run.remaining != null ? `剩 ${run.remaining} 個名額` : ""].filter(Boolean).join(" · ")}
                </AppText>
                {run.enrollment === "pending" ? pendingRow(run) : run.enrollment === null && run.open && !course.isPublic ? registerButton(run.free, run.id, run) : null}
              </Card>
            ))}
            {!course.runs.length ? <NoticeBox text="目前沒有開放報名的場次。" /> : null}
          </Section>
        ) : course.enrollment === "pending" ? (
          pendingRow()
        ) : course.enrollment === null && !course.isPublic ? (
          registerButton(course.free, "course")
        ) : null}

        <Section title="課程章節">
          <View>
          <Card style={{ paddingVertical: 0, ...(allLocked ? { minHeight: 170 } : {}) }}>
            {course.lessons.map((lesson) => {
              const run = lesson.runId ? course.runs.find((r) => r.id === lesson.runId) : null;
              return (
                <ListRow
                  key={lesson.id}
                  icon={lesson.completed ? "checkmark-circle" : lesson.locked ? "lock-closed-outline" : lesson.kind === "audio" ? "musical-notes-outline" : "play-circle-outline"}
                  title={`${lesson.position}. ${lesson.title}`}
                  subtitle={`${run ? `${run.title} · ` : ""}${lesson.minutes ? `${lesson.minutes} 分鐘` : ""}${lesson.completed ? `${lesson.minutes ? " · " : ""}已完成` : ""}` || undefined}
                  right={lesson.eventDate ? <AppText variant="callout" tone="muted">{eventDays(lesson.eventDate, null)}</AppText> : undefined}
                  onPress={lesson.locked ? undefined : () => router.push(`/learn/${course.id}/${lesson.id}`)}
                />
              );
            })}
          </Card>
          {allLocked ? (
            <View style={styles.mask} accessibilityRole="alert" accessibilityLabel={lockedText}>
              <Ionicons name="lock-closed" size={48} color="#fff" />
              <AppText variant="title" style={{ color: "#fff", textAlign: "center" }}>
                {lockedText}
              </AppText>
            </View>
          ) : null}
          </View>
        </Section>
        {member ? <CommentBoard courseId={course.id} /> : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  mask: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16, backgroundColor: "rgba(70,76,72,0.72)", alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.md },
  pending: { flexDirection: "row", alignItems: "center", gap: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
});
