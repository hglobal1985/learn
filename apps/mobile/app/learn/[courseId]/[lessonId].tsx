import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveLastLesson } from "@/lib/last-lesson";
import { Platform, StyleSheet, View } from "react-native";
import { api, type CourseDetail, type Playback } from "@/api/client";
import { AttachmentList } from "@/features/attachments";
import { HeaderShare } from "@/features/share-button";
import { InlineAudio } from "@/features/player/audio-bar";
import { engine } from "@/features/player/engine";
import { eventDays } from "@/features/format";
import { buildTrack } from "@/features/player/engine.types";
import { LessonPlayer } from "@/features/player/lesson-player";
import { PlayerSlot } from "@/features/player/player-slot";
import { usePlayer } from "@/features/player/use-player";
import { PlayerControls } from "@/features/player/player-controls";
import { useApi, useSession } from "@/state/session";
import { maxContentWidth, space } from "@/theme/tokens";
import { AppText, Button, Card, ErrorView, ListRow, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

export default function LessonScreen() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const { invalidate, ready, member } = useSession();
  const course = useApi<CourseDetail>(`/courses/${courseId}`);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
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
  useEffect(() => {
    if (member && c && lessonRow) saveLastLesson(member.sub, { courseId: c.id, lessonId: lessonRow.id, lessonTitle: lessonRow.title, courseTitle: c.title });
  }, [member?.sub, c?.id, lessonRow?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // 沒有「完成」按鈕了：這一堂播放到結尾，自動記錄完成。（Hook 必須放在所有提前 return 之前）
  const autoDone = useRef<string | null>(null);
  const curLesson = c?.lessons.find((l) => l.id === lessonId);
  // 播放超過 95% 就算完成（有設定起訖時間的章節，以那一段為準）；播到結尾也算。
  const here = !!track && player.track?.key === track.key;
  const segStart = curLesson?.start ?? 0;
  const segEnd = curLesson?.end ?? player.duration;
  const segLen = segEnd - segStart;
  const watched = here && segLen > 0 && (player.position - segStart) / segLen >= 0.95;
  const finished = legacyYoutube ? legacyDone : here && (player.segmentEnded || watched);
  useEffect(() => {
    if (!c || !curLesson || !member || !finished || curLesson.completed || autoDone.current === curLesson.id) return;
    autoDone.current = curLesson.id;
    api("POST", `/courses/${c.id}/lessons/${curLesson.id}/complete`)
      .then(() => {
        invalidate();
        course.reload();
      })
      .catch((e: Error) => setPlayError(e.message));
  }, [finished, member?.sub, curLesson?.id, curLesson?.completed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <Screen header={false}>{course.loading ? <LoadingView /> : <ErrorView message={course.error ?? "找不到課程"} onRetry={course.reload} />}</Screen>;
  const index = c.lessons.findIndex((l) => l.id === lessonId);
  const lesson = c.lessons[index];
  const next = c.lessons[index + 1];
  if (!lesson) return <Screen header={false}><ErrorView message="找不到這個章節" /></Screen>;

  const segmentDone = legacyYoutube ? legacyDone : player.track?.key === track?.key && player.segmentEnded;
  const engineError = track && player.track?.key === track.key ? player.error : null;
  const pinned = !!track && claimed === track.key;

  return (
    <View style={{ flex: 1 }}>
      {/* 影片（或純音檔的控制列）釘在上方不隨內容捲動；播放控制列在影片外面下方，三種模式共用同一個元件。離開本頁後縮成可拖曳的小視窗。 */}
      {pinned ? (
        <View>
          {track.mode === "audio" ? (
            <InlineAudio trackKey={track.key} />
          ) : (
            <>
              <PlayerSlot trackKey={track.key} />
              <PlayerControls />
            </>
          )}
        </View>
      ) : null}
    <Screen header={false} tight gap={space.sm}>
      <Stack.Screen options={{ title: c.title, headerRight: () => <HeaderShare title={`${c.title}｜${lesson.title}`} path={`/learn/${c.id}/${lesson.id}`} /> }} />
      {legacyYoutube && playback ? (
        <LessonPlayer playback={playback} onSegmentEnd={() => setLegacyDone(true)} />
      ) : playError ? (
        <NoticeBox tone="danger" text={playError} />
      ) : !pinned && !track ? (
        <LoadingView />
      ) : null}
      {engineError ? <NoticeBox tone="danger" text={engineError} /> : null}
      {playback?.kind === "demo" ? <Pill label={playback.label} tone="warning" /> : null}
      <View style={{ gap: space.xs }}>
        <View style={styles.titleRow}>
          <AppText variant="title" style={{ flex: 1 }}>
            {lesson.title}
          </AppText>
          {member ? <AttachmentList courseId={c.id} lessonId={lesson.id} /> : null}
          {lesson.eventDate ? (
            <AppText variant="callout" tone="muted" style={{ textAlign: "right", flexShrink: 0, paddingTop: 4 }}>
              {eventDays(lesson.eventDate, null)}
            </AppText>
          ) : null}
        </View>
      </View>
      {!member || (lesson.completed && !next) ? (
      <View style={styles.row}>
        {!member ? (
          <>
            <NoticeBox text="登入後可以記錄學習進度、下載附件教材與留言。" />
            <Button variant="secondary" label="登入" icon="log-in-outline" onPress={() => router.push({ pathname: "/me", params: { next: `/learn/${c.id}/${lesson.id}` } })} />
          </>
        ) : lesson.completed && !next ? (
          <NoticeBox tone="success" text="恭喜！你已完成這門課程的最後一堂。" />
        ) : null}
      </View>
      ) : null}
      <View>
        <Card style={{ paddingVertical: 0 }}>
          {c.lessons.filter((l) => !l.full).map((l) => (
            <ListRow
              key={l.id}
              icon={l.completed ? "checkmark-circle" : l.id === lesson.id ? "play-circle" : "play-circle-outline"}
              title={`${l.position}. ${l.title}`}
              subtitle={l.id === lesson.id ? "正在觀看" : l.minutes ? `約 ${l.minutes} 分鐘` : undefined}
              highlight={l.id === lesson.id}
              dense
              right={l.eventDate ? <AppText variant="callout" tone="muted">{eventDays(l.eventDate, null)}</AppText> : undefined}
              onPress={l.id === lesson.id || l.locked ? undefined : () => {
                engine.expectSwitch();
                router.replace(`/learn/${c.id}/${l.id}`);
              }}
            />
          ))}
        </Card>
      </View>
      {c.lessons.some((l) => l.full) ? (
        <View style={{ gap: space.xs }}>
          <AppText variant="headline">完整版(含主持/串場/影片)</AppText>
          <Card style={{ paddingVertical: 0 }}>
            {c.lessons
              .filter((l) => l.full)
              .map((l) => (
                <ListRow
                  key={l.id}
                  icon={l.id === lesson.id ? "play-circle" : "play-circle-outline"}
                  title={l.title}
                  subtitle={l.id === lesson.id ? "正在觀看" : l.minutes ? `約 ${l.minutes} 分鐘` : undefined}
                  highlight={l.id === lesson.id}
                  dense
                  onPress={l.id === lesson.id || l.locked ? undefined : () => {
                    engine.expectSwitch();
                    router.replace(`/learn/${c.id}/${l.id}`);
                  }}
                />
              ))}
          </Card>
        </View>
      ) : null}
    </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
