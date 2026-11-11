import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { owned } from "@/domain/domain";
import { CourseCard } from "@/features/courses/course-card";
import { useStore } from "@/state/store";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, SandboxBanner, Screen, Section } from "@/ui";

export default function HomeScreen() {
  const { state } = useStore();
  const published = state.courses.filter((c) => c.published);
  const mine = published.filter((c) => owned(state, c.id));
  const featured = published.filter((c) => !owned(state, c.id)).slice(0, 3);
  return (
    <Screen title="寰宇行動大學" subtitle={state.member ? `${state.member.name}，歡迎回來` : "隨時隨地，持續成長"}>
      <SandboxBanner />
      {!state.member ? (
        <Card>
          <AppText variant="headline">登入後即可領取課程</AppText>
          <AppText variant="callout" tone="muted">
            目前使用測試帳號登入，之後會改成寰宇中央會員。
          </AppText>
          <View style={styles.actions}>
            <Button label="前往登入" icon="log-in-outline" onPress={() => router.navigate("/me")} />
          </View>
        </Card>
      ) : null}
      {mine.length ? (
        <Section title="繼續學習" action={<Button variant="ghost" label="全部" onPress={() => router.navigate("/learning")} />}>
          <CourseCard course={mine[0]} />
        </Section>
      ) : null}
      <Section title="推薦課程" action={<Button variant="ghost" label="看全部" onPress={() => router.navigate("/courses")} />}>
        {featured.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: "row", marginTop: space.sm } });
