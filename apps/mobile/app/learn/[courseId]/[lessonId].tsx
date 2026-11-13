import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { api, type CourseDetail, type Playback } from "@/api/client";
import { AttachmentList } from "@/features/attachments";
import { InlineAudio } from "@/features/player/audio-bar";
import { engine } from "@/features/player/engine";
import { eventDays } from "@/features/format";
import { buildTrack } from "@/features/player/engine.types";
import { LessonPlayer } from "@/features/player/lesson-player";
import { PlayerSlot } from "@/features/player/player-slot";
import { usePlayer } from "@/features/player/use-player";
import { YouTubeControls } from "@/features/player/youtube-controls";
import { useApi, useSession } from "@/state/session";
import { maxContentWidth, space } from "@/theme/tokens";
import { AppText, Button, Card, ErrorView, ListRow, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

export default function LessonScreen() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const { invalidate, ready, member } = useSession();
  const course = useApi<CourseDetail>(`/courses/${courseId}`);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const player = usePlayer();
  // 手機 App 的 YouTube 仍在課程頁內嵌播放（WebView 無法跨頁保留）；其餘一律交給全站單一播放器。
  const legacyYoutube = Platform.OS !== "web" && playback?.kind === "youtube";
  const [legacyDone, setLegacyDone] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);

  // 等登入狀態載入完成再要播放授權（直接開啟連結或重新整理時）。
  useEffect(() => {
    if (!ready) return;
    setPlayback(null);
    setLegacyDone(false);
    setPlayError(null);
    api<Playback>("GET", `/courses/${courseId}/lessons/${lessonId}/playback`)
      .then(setPlayback)
      .catch((e: Error) => setPlayError(e.message));
  }, [courseId, lessonId, ready, member?.sub]);

  const c = course.data;
  const lessonRow = c?.lessons.find((l) => l.id === lessonId);
  const track = useMemo(
    () => (playback && c && lessonRow && !legacyYoutube ? buildTrack(playback, { courseId: c.id, lessonId: lessonRow.id, title: lessonRow.title, subtitle: c.title, artwork: c.edmUrl }) : null),
    [playback, c?.id, c?.title, lessonRow?.id, lessonRow?.title, legacyYoutube],
  );
  // 要播這一堂：同一堂直接接上；另一堂正在播放就詢問是否中斷，選「繼續原本的」就回到原本那一堂。
  useEffect(() => {
    if (legacyYoutube) engine.close();
    if (!track) return;
    let alive = true;
    engine.request(track).then((ok) => {
      if (!alive) return;
      if (ok) return setClaimed(track.key);
      const cur = engine.getSnapshot().track;
      if (cur) router.replace(`/learn/${cur.courseId}/${cur.lessonId}`);
    });
    return () => {
      alive = false;
    };
  }, [track, legacyYoutube]);

  if (!c) return <Screen header={false}>{course.loading ? <LoadingView /> : <ErrorView message={course.error ?? "找不到課程"} onRetry={course.reload} />}</Screen>;
  const index = c.lessons.findIndex((l) => l.id === lessonId);
  const lesson = c.lessons[index];
  const next = c.lessons[index + 1];
  if (!lesson) return <Screen header={false}><ErrorView message="找不到這個章節" /></Screen>;

  const segmentDone = legacyYoutube ? legacyDone : player.track?.key === track?.key && player.segmentEnded;
  const engineError = track && player.track?.key === track.key ? player.error : null;
  const picture = track && track.mode !== "audio" && claimed === track.key;

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
    <View style={{ flex: 1 }}>
      {/* 影片釘在上方不隨內容捲動，往下看附件與進度時也看得到畫面；離開本頁後縮成可拖曳的小視窗。 */}
      {picture ? (
        <View style={styles.pinned}>
          <View style={styles.pinnedInner}>
            <PlayerSlot trackKey={track.key} />
            {track.mode === "youtube" ? <YouTubeControls /> : null}
          </View>
        </View>
      ) : null}
    <Screen header={false}>
      <Stack.Screen options={{ title: c.title }} />
      {legacyYoutube && playback ? (
        <LessonPlayer playback={playback} onSegmentEnd={() => setLegacyDone(true)} />
      ) : track?.mode === "audio" && claimed === track.key ? (
        <InlineAudio trackKey={track.key} />
      ) : playError ? (
        <NoticeBox tone="danger" text={playError} />
      ) : !picture && !track ? (
        <LoadingView />
      ) : null}
      {engineError ? <NoticeBox tone="danger" text={engineError} /> : null}
      {playback?.kind === "demo" ? <Pill label={playback.label} tone="warning" /> : null}
      <View style={{ gap: space.xs }}>
        <AppText variant="caption" tone="muted">
          第 {lesson.position} 堂 · {lesson.minutes} 分鐘
        </AppText>
        <View style={styles.titleRow}>
          <AppText variant="title" style={{ flex: 1 }}>
            {lesson.title}
          </AppText>
          {lesson.eventDate ? (
            <AppText variant="callout" tone="muted" style={{ textAlign: "right", flexShrink: 0, paddingTop: 4 }}>
              {eventDays(lesson.eventDate, null)}
            </AppText>
          ) : null}
        </View>
      </View>
      {member ? <AttachmentList courseId={c.id} lessonId={lesson.id} /> : null}
      {segmentDone && !lesson.completed ? <NoticeBox tone="success" text="這一堂播放完畢，按「完成」記錄進度。" /> : null}
      <View style={styles.row}>
        {!member ? (
          <>
            <NoticeBox text="登入後可以記錄學習進度、下載附件教材與留言。" />
            {next && !next.locked ? <Button label="下一堂" icon="play-forward" onPress={() => router.replace(`/learn/${c.id}/${next.id}`)} /> : null}
            <Button variant="secondary" label="登入" icon="log-in-outline" onPress={() => router.push({ pathname: "/me", params: { next: `/learn/${c.id}/${lesson.id}` } })} />
          </>
        ) : lesson.completed ? (
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
              right={l.eventDate ? <AppText variant="callout" tone="muted">{eventDays(l.eventDate, null)}</AppText> : undefined}
              onPress={l.id === lesson.id || l.locked ? undefined : () => router.replace(`/learn/${c.id}/${l.id}`)}
            />
          ))}
        </Card>
      </Section>
    </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pinned: { backgroundColor: "#000", alignItems: "center" },
  pinnedInner: { width: "100%", maxWidth: maxContentWidth },
});
