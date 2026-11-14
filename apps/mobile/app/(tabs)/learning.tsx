import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { loadLastLesson, type LastLesson } from "@/lib/last-lesson";
import { StyleSheet, View } from "react-native";
import { api, type CourseSummary } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { cleanUnit } from "@/features/format";
import { CourseCard } from "@/features/courses/course-card";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, LoadingView, NoticeBox, Screen, Section, Select } from "@/ui";
import { showToast } from "@/ui/toast";

export default function LearningScreen() {
  const { member } = useSession();
  const { data, error, loading, reload } = useApi<CourseSummary[]>(member ? "/courses" : null);
  const [last, setLast] = useState<LastLesson | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (member) loadLastLesson(member.sub).then(setLast);
    }, [member?.sub]), // eslint-disable-line react-hooks/exhaustive-deps
  );
  /** 免費課程可以從「學習中」隱藏（付費課程沒有這顆 X）。 */
  const hide = async (course: CourseSummary) => {
    if (!(await confirmSheet({ title: "從學習中隱藏", message: "這門免費課程會從「學習中」消失，之後再打開課程頁就會回來。", confirmLabel: "隱藏", cancelLabel: "先不要" }))) return;
    try {
      await api("POST", `/courses/${course.id}/hide-learning`);
      reload();
    } catch (e) {
      showToast((e as Error).message);
    }
  };
  /** 免費課程可以隱藏；沒報名紀錄、只是播放過的課程（管理員或公開課程）也可以隱藏。 */
  const canHide = (c: CourseSummary) => (c.enrollment === "opened" && (c.watchFree || c.isPublic)) || (c.enrollment !== "opened" && c.started);
  // 學習中＝已開通的課程，或播放超過 1% 的課程（含免費、沒有報名紀錄的）；等待審核的另外顯示。
  const inLearning = (c: CourseSummary) => (c.enrollment === "opened" || c.started) && !c.hiddenFromLearning;
  const [kind, setKind] = useState("");
  const [unit, setUnit] = useState("");
  const enrolled = useMemo(() => (data ?? []).filter((c) => inLearning(c) || c.enrollment === "pending"), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const units = useMemo(() => [...new Set(enrolled.flatMap((c) => c.hostUnit.split("、")).filter(Boolean))], [enrolled]);
  const shown = (data ?? []).filter((c) => (kind === "" || (kind === "free" ? c.free : !c.free)) && (unit === "" || c.hostUnit.split("、").includes(unit)));
  const mine = shown.filter(inLearning);
  const pending = shown.filter((c) => c.enrollment === "pending");
  const inProgress = mine.filter((c) => c.completedLessons < c.lessonCount);
  const finished = mine.filter((c) => c.lessonCount > 0 && c.completedLessons >= c.lessonCount);
  const resume = last && mine.some((c) => c.id === last.courseId) ? last : null;
  if (!member)
    return (
      <Screen>
        <EmptyState
          icon="person-circle-outline"
          title="尚未登入"
          body="登入後，這裡會列出你已開通的課程與學習進度。"
          action={<Button label="前往登入" onPress={() => router.navigate("/me")} />}
        />
      </Screen>
    );
  return (
    <Screen>
      {enrolled.length ? (
        <View style={styles.filters}>
          <Select label="費用" value={kind} options={[{ key: "", label: "全部（免費與付費）" }, { key: "free", label: "免費" }, { key: "paid", label: "付費" }]} onChange={setKind} />
          <Select label="主辦單位" value={unit} options={[{ key: "", label: "全部單位" }, ...units.map((u) => ({ key: u, label: cleanUnit(u) }))]} onChange={setUnit} />
        </View>
      ) : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {pending.length ? <NoticeBox tone="warning" text={`${pending.length} 門課程等待管理員確認，開通後會通知你。`} /> : null}
      {data && !mine.length && enrolled.some(inLearning) ? <EmptyState icon="library-outline" title="沒有符合條件的課程" /> : null}
      {data && !enrolled.some(inLearning) ? (
        <EmptyState
          icon="play-circle-outline"
          title="還沒有開通的課程"
          body="到課程頁挑一門免費課程，報名後立刻就能開始。"
          action={<Button label="去找課程" onPress={() => router.navigate("/courses")} />}
        />
      ) : null}
      {resume ? (
        <Card>
          <AppText variant="caption" tone="muted">{resume.courseTitle}</AppText>
          <AppText variant="callout" numberOfLines={2} style={{ fontWeight: "700" }}>{resume.lessonTitle}</AppText>
          <Button label="回到剛才的學習" icon="play-circle-outline" onPress={() => router.push(`/learn/${resume.courseId}/${resume.lessonId}`)} fullWidth />
        </Card>
      ) : null}
      {inProgress.length ? (
        <View style={styles.list}>
          {inProgress.map((course) => (
            <CourseCard key={course.id} course={course} onHide={canHide(course) ? () => hide(course) : undefined} />
          ))}
        </View>
      ) : null}
      {finished.length ? (
        <Section title="已完成">
          {finished.map((course) => (
            <CourseCard key={course.id} course={course} onHide={canHide(course) ? () => hide(course) : undefined} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ filters: { flexDirection: "row", gap: space.sm }, list: { gap: space.md } });
