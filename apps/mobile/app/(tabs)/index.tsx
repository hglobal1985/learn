import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import type { CourseSummary } from "@/api/client";
import { CourseCard } from "@/features/courses/course-card";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, ErrorView, LoadingView, SandboxBanner, Screen, Section } from "@/ui";

export default function HomeScreen() {
  const { member } = useSession();
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const courses = data ?? [];
  const mine = courses.filter((c) => c.enrollment === "opened");
  const next = mine.find((c) => c.completedLessons < c.lessonCount) ?? mine[0];
  const featured = courses.filter((c) => c.enrollment !== "opened").slice(0, 3);
  return (
    <Screen title="寰宇行動大學" subtitle={member ? `${member.name}，歡迎回來` : "隨時隨地，持續成長"}>
      <SandboxBanner text="內部測試版：課程內容與影片目前為示範資料。" />
      {!member ? (
        <Card>
          <AppText variant="headline">登入後即可報名課程</AppText>
          <AppText variant="callout" tone="muted">
            使用 Google 帳號登入，課程資格會依會員中心的資料自動判斷。
          </AppText>
          <View style={styles.actions}>
            <Button label="前往登入" icon="log-in-outline" onPress={() => router.navigate("/me")} />
          </View>
        </Card>
      ) : null}
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {next ? (
        <Section title="繼續學習" action={<Button variant="ghost" label="全部" onPress={() => router.navigate("/learning")} />}>
          <CourseCard course={next} />
        </Section>
      ) : null}
      {featured.length ? (
        <Section title="推薦課程" action={<Button variant="ghost" label="看全部" onPress={() => router.navigate("/courses")} />}>
          {featured.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: "row", marginTop: space.sm } });
