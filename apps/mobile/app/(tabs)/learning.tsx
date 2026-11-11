import { router } from "expo-router";
import { owned } from "@/domain/domain";
import { CourseCard } from "@/features/courses/course-card";
import { useStore } from "@/state/store";
import { Button, EmptyState, Screen } from "@/ui";

export default function LearningScreen() {
  const { state } = useStore();
  const mine = state.courses.filter((c) => owned(state, c.id));
  return (
    <Screen title="我的課程" subtitle={state.member ? `已開通 ${mine.length} 門` : undefined}>
      {!state.member ? (
        <EmptyState
          icon="person-circle-outline"
          title="尚未登入"
          body="登入後，這裡會列出你已開通的課程與學習進度。"
          action={<Button label="前往登入" onPress={() => router.navigate("/me")} />}
        />
      ) : mine.length ? (
        mine.map((course) => <CourseCard key={course.id} course={course} />)
      ) : (
        <EmptyState
          icon="play-circle-outline"
          title="還沒有開通的課程"
          body="到課程頁挑一門免費課程，領取後立刻就能開始。"
          action={<Button label="去找課程" onPress={() => router.navigate("/courses")} />}
        />
      )}
    </Screen>
  );
}
