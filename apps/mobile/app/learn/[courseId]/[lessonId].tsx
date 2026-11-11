import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, resolveUrl, type CourseDetail, type Playback } from "@/api/client";
import { DemoPlayer } from "@/features/player/demo-player";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, ErrorView, ListRow, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

export default function LessonScreen() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const { invalidate } = useSession();
  const course = useApi<CourseDetail>(`/courses/${courseId}`);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPlayback(null);
    setPlayError(null);
    api<Playback>("GET", `/courses/${courseId}/lessons/${lessonId}/playback`)
      .then(setPlayback)
      .catch((e: Error) => setPlayError(e.message));
  }, [courseId, lessonId]);

  const c = course.data;
  if (!c) return <Screen header={false}>{course.loading ? <LoadingView /> : <ErrorView message={course.error ?? "找不到課程"} onRetry={course.reload} />}</Screen>;
  const index = c.lessons.findIndex((l) => l.id === lessonId);
  const lesson = c.lessons[index];
  const next = c.lessons[index + 1];
  if (!lesson) return <Screen header={false}><ErrorView message="找不到這個章節" /></Screen>;

  const complete = async () => {
    setSaving(true);
    try {
      await api("POST", `/courses/${c.id}/lessons/${lesson.id}/complete`);
      invalidate();
      if (next) router.replace(`/learn/${c.id}/${next.id}`);
    } catch (e) {
      setPlayError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: c.title }} />
      {playback ? <DemoPlayer key={playback.url} url={resolveUrl(playback.url)} /> : playError ? <NoticeBox tone="danger" text={playError} /> : <LoadingView />}
      {playback ? <Pill label={playback.label} tone="warning" /> : null}
      <View style={{ gap: space.xs }}>
        <AppText variant="caption" tone="muted">
          第 {lesson.position} 堂 · {lesson.minutes} 分鐘
        </AppText>
        <AppText variant="title">{lesson.title}</AppText>
      </View>
      <View style={styles.row}>
        {lesson.completed ? (
          next ? (
            <Button label="下一堂" icon="play-forward" onPress={() => router.replace(`/learn/${c.id}/${next.id}`)} />
          ) : (
            <NoticeBox tone="success" text="恭喜！你已完成這門課程的最後一堂。" />
          )
        ) : (
          <Button label={next ? "完成，下一堂" : "完成這堂課"} icon="checkmark" loading={saving} onPress={complete} />
        )}
      </View>
      <Section title={`課程進度 ${c.completedLessons}/${c.lessonCount}`}>
        <Card style={{ paddingVertical: 0 }}>
          {c.lessons.map((l) => (
            <ListRow
              key={l.id}
              icon={l.completed ? "checkmark-circle" : l.id === lesson.id ? "play-circle" : "play-circle-outline"}
              title={`${l.position}. ${l.title}`}
              subtitle={l.id === lesson.id ? "正在觀看" : `${l.minutes} 分鐘`}
              onPress={l.id === lesson.id ? undefined : () => router.replace(`/learn/${c.id}/${l.id}`)}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm } });
