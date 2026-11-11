import { router } from "expo-router";
import type { CourseSummary } from "@/api/client";
import { CourseCard } from "@/features/courses/course-card";
import { useApi, useSession } from "@/state/session";
import { Button, EmptyState, ErrorView, LoadingView, NoticeBox, Screen, Section } from "@/ui";

export default function LearningScreen() {
  const { member } = useSession();
  const { data, error, loading, reload } = useApi<CourseSummary[]>(member ? "/courses" : null);
  const mine = (data ?? []).filter((c) => c.enrollment === "opened");
  const pending = (data ?? []).filter((c) => c.enrollment === "pending");
  const inProgress = mine.filter((c) => c.completedLessons < c.lessonCount);
  const finished = mine.filter((c) => c.lessonCount > 0 && c.completedLessons >= c.lessonCount);
  if (!member)
    return (
      <Screen title="我的課程">
        <EmptyState
          icon="person-circle-outline"
          title="尚未登入"
          body="登入後，這裡會列出你已開通的課程與學習進度。"
          action={<Button label="前往登入" onPress={() => router.navigate("/me")} />}
        />
      </Screen>
    );
  return (
    <Screen title="我的課程" subtitle={data ? `已開通 ${mine.length} 門` : undefined}>
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {pending.length ? <NoticeBox tone="warning" text={`${pending.length} 門課程等待管理員確認，開通後會通知你。`} /> : null}
      {data && !mine.length ? (
        <EmptyState
          icon="play-circle-outline"
          title="還沒有開通的課程"
          body="到課程頁挑一門免費課程，報名後立刻就能開始。"
          action={<Button label="去找課程" onPress={() => router.navigate("/courses")} />}
        />
      ) : null}
      {inProgress.length ? (
        <Section title="學習中">
          {inProgress.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </Section>
      ) : null}
      {finished.length ? (
        <Section title="已完成">
          {finished.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
