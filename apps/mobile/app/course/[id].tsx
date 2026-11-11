import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api, type CourseDetail, type CourseRun, type Order } from "@/api/client";
import { CoursePriceTag, UnitTags } from "@/features/courses/course-card";
import { dateTime, ntd } from "@/features/format";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, CourseCover, ErrorView, ListRow, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

const isWeb = Platform.OS === "web";

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, ready, invalidate } = useSession();
  const { data: course, error, loading, reload } = useApi<CourseDetail>(member ? `/courses/${id}` : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  // 課程介紹頁需登入：未登入導向登入，完成後回到這一頁。
  if (ready && !member) return <Redirect href={{ pathname: "/me", params: { next: `/course/${id}` } }} />;
  if (!course)
    return (
      <Screen header={false}>
        {loading || !ready ? <LoadingView /> : <ErrorView message={error ?? "找不到這門課程"} onRetry={reload} />}
      </Screen>
    );

  const admin = member?.role === "admin";
  const playable = course.lessons.filter((l) => !l.locked);
  const nextLesson = playable.find((l) => !l.completed) ?? playable[0];

  /** 報名：免費立即開通；付費建立待審核的報名並前往報名明細。 */
  const register = async (run?: CourseRun) => {
    setBusy(run?.id ?? "course");
    setMessage(null);
    try {
      const [order] = await api<Order[]>("POST", "/orders", { items: [{ courseId: course.id, runId: run?.id ?? "" }] });
      invalidate();
      if (order.status === "opened") setMessage({ tone: "success", text: "報名成功！課程已開通，可以開始上課了。" });
      else router.push(`/orders/${order.id}`);
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const registerButton = (free: boolean, key: string, run?: CourseRun) => {
    if (!course.eligible) return <NoticeBox tone="warning" text={`這門課程限 ${course.minRank.name} 以上獎銜的會員報名。`} />;
    if (free) return <Button label="免費報名" icon="gift-outline" loading={busy === key} disabled={!!busy} onPress={() => register(run)} fullWidth />;
    // iOS/Android：依商店規範不顯示付費報名方式，只說明尚未開通。
    if (!isWeb) return <NoticeBox text="這門課程尚未為你開通。開通後即可在這裡觀看。" />;
    return <Button label="報名（送出後由窗口審核繳費）" icon="create-outline" loading={busy === key} disabled={!!busy} onPress={() => register(run)} fullWidth />;
  };
  const pendingBox = (
    <>
      <NoticeBox tone="warning" text="報名審核中，窗口確認繳費後會通知你。" />
      {isWeb ? <Button variant="secondary" label="查看我的報名" onPress={() => router.push("/orders")} fullWidth /> : null}
    </>
  );

  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: course.title }} />
      <CourseCover theme={course.theme} label={course.category} height={160} />
      <View style={{ gap: space.sm }}>
        <AppText variant="display">{course.title}</AppText>
        <AppText tone="muted">{course.subtitle}</AppText>
        <UnitTags course={course} />
        <View style={styles.row}>
          <CoursePriceTag course={course} />
          {course.minRank.order > 10 ? <Pill label={`限 ${course.minRank.name} 以上`} tone={course.eligible ? "neutral" : "warning"} /> : null}
          {course.freeNow && course.freeUntil ? <Pill label={`限時免費至 ${dateTime(course.freeUntil)}`} tone="accent" /> : null}
        </View>
        <AppText variant="callout" tone="muted">
          講師：{course.teacher} · {course.lessonCount} 堂 · 約 {course.totalMinutes} 分鐘
        </AppText>
        {course.description ? <AppText>{course.description}</AppText> : null}
      </View>
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      {nextLesson && (course.enrollment === "opened" || admin) ? (
        <Button label={course.completedLessons ? "繼續上課" : "開始上課"} icon="play" onPress={() => router.push(`/learn/${course.id}/${nextLesson.id}`)} fullWidth />
      ) : null}

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
              {run.enrollment === "pending" ? pendingBox : run.enrollment === null && run.open ? registerButton(run.free, run.id, run) : null}
            </Card>
          ))}
          {!course.runs.length ? <NoticeBox text="目前沒有開放報名的場次。" /> : null}
        </Section>
      ) : course.enrollment === "pending" ? (
        <View style={{ gap: space.sm }}>{pendingBox}</View>
      ) : course.enrollment === null ? (
        <View style={{ gap: space.sm }}>{registerButton(course.free, "course")}</View>
      ) : null}

      <Section title="課程章節">
        <Card style={{ paddingVertical: 0 }}>
          {course.lessons.map((lesson) => {
            const run = lesson.runId ? course.runs.find((r) => r.id === lesson.runId) : null;
            return (
              <ListRow
                key={lesson.id}
                icon={lesson.completed ? "checkmark-circle" : lesson.locked ? "lock-closed-outline" : lesson.kind === "audio" ? "musical-notes-outline" : "play-circle-outline"}
                title={`${lesson.position}. ${lesson.title}`}
                subtitle={`${run ? `${run.title} · ` : ""}${lesson.minutes} 分鐘${lesson.completed ? " · 已完成" : ""}`}
                onPress={lesson.locked ? undefined : () => router.push(`/learn/${course.id}/${lesson.id}`)}
              />
            );
          })}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm } });
