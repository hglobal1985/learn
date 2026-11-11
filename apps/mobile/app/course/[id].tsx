import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api, type CourseDetail, type Order } from "@/api/client";
import { CoursePriceTag } from "@/features/courses/course-card";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, CourseCover, ErrorView, ListRow, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, invalidate, cart, setCart } = useSession();
  const { data: course, error, loading, reload } = useApi<CourseDetail>(`/courses/${id}`);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  if (!course)
    return (
      <Screen header={false}>
        {loading ? <LoadingView /> : <ErrorView message={error ?? "找不到這門課程"} onRetry={reload} />}
      </Screen>
    );

  const opened = course.enrollment === "opened" || claimed || member?.role === "admin";
  const nextLesson = course.lessons.find((l) => !l.completed) ?? course.lessons[0];
  const inCart = cart.includes(course.id);

  const claim = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api<Order[]>("POST", "/orders", { courseIds: [course.id] });
      setClaimed(true);
      setMessage({ tone: "success", text: "領取成功！課程已開通，可以開始上課了。" });
      invalidate();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  let action: React.ReactNode;
  if (!member) action = <Button label="登入後領取" icon="log-in-outline" onPress={() => router.navigate("/me")} fullWidth />;
  else if (opened && nextLesson)
    action = (
      <Button
        label={course.completedLessons ? "繼續上課" : "開始上課"}
        icon="play"
        onPress={() => router.push(`/learn/${course.id}/${nextLesson.id}`)}
        fullWidth
      />
    );
  else if (course.enrollment === "pending")
    action = (
      <>
        <NoticeBox tone="warning" text="訂單等待管理員確認收款，開通後會通知你。" />
        {Platform.OS === "web" ? <Button variant="secondary" label="查看我的訂單" onPress={() => router.push("/orders")} fullWidth /> : null}
      </>
    );
  else if (!course.eligible) action = <NoticeBox tone="warning" text={`這門課程限 ${course.minRank.name} 以上獎銜的會員領取。`} />;
  else if (course.free) action = <Button label="免費領取" icon="gift-outline" loading={busy} onPress={claim} fullWidth />;
  else if (Platform.OS === "web")
    action = inCart ? (
      <Button label="前往購物車結帳" icon="cart" onPress={() => router.push("/cart")} fullWidth />
    ) : (
      <Button label="加入購物車" icon="cart-outline" onPress={() => setCart([...cart, course.id])} fullWidth />
    );
  // iOS/Android：依商店規範不顯示購買方式，只說明尚未開通。
  else action = <NoticeBox text="這門課程尚未為你開通。開通後即可在這裡觀看。" />;

  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: course.title }} />
      <CourseCover theme={course.theme} label={course.category} height={160} />
      <View style={{ gap: space.sm }}>
        <AppText variant="display">{course.title}</AppText>
        <AppText tone="muted">{course.subtitle}</AppText>
        <View style={styles.row}>
          <CoursePriceTag course={course} />
          {course.minRank.order > 0 ? <Pill label={`限 ${course.minRank.name} 以上`} tone={course.eligible ? "neutral" : "warning"} /> : null}
        </View>
        <AppText variant="callout" tone="muted">
          講師：{course.teacher} · {course.lessonCount} 堂 · 約 {course.totalMinutes} 分鐘
        </AppText>
      </View>
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      <View style={{ gap: space.sm }}>{action}</View>
      <Section title="課程章節">
        <Card style={{ paddingVertical: 0 }}>
          {course.lessons.map((lesson) => (
            <ListRow
              key={lesson.id}
              icon={lesson.completed ? "checkmark-circle" : opened ? "play-circle-outline" : "lock-closed-outline"}
              title={`${lesson.position}. ${lesson.title}`}
              subtitle={`${lesson.minutes} 分鐘${lesson.completed ? " · 已完成" : ""}`}
              onPress={opened ? () => router.push(`/learn/${course.id}/${lesson.id}`) : undefined}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm } });
