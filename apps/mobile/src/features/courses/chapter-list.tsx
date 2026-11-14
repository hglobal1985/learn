import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveUrl, type CourseSummary } from "@/api/client";
import { eventDays, sharerLine } from "@/features/format";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, CourseCover } from "@/ui";
import type { SearchLesson } from "./course-search";

export type ChapterGroup = { key: string; title: string; items: { lesson: SearchLesson; course: CourseSummary; locked: boolean }[] };

/**
 * 課程清單的「章節模式」：一堂一列，依系列分組。
 * 每列：課程封面縮圖、章節標題、分享者（獎銜、職稱）、日期與所屬課程、狀態（已完成／報名後觀看／敬請期待）。
 * 點一列：能看就直接進該章節播放，不能看（尚未報名、內容準備中）進課程介紹頁。
 */
export function ChapterList({ groups }: { groups: ChapterGroup[] }) {
  const { c } = useTheme();
  return (
    <View>
      {groups.map((g) => (
        <View key={g.key}>
          <View style={styles.head}>
            <AppText variant="headline" style={{ color: c.accentText, flexShrink: 1 }} numberOfLines={1}>
              {g.title}
            </AppText>
            <AppText variant="caption" tone="muted">
              {g.items.length} 堂
            </AppText>
          </View>
          {g.items.map(({ lesson, course, locked }) => {
            const who = sharerLine({ sharer: lesson.sharer, sharerRankName: lesson.sharerRankName, sharerTitle: lesson.sharerTitle }).replace(/^分享者：/, "");
            const date = lesson.eventDate ? eventDays(lesson.eventDate, null) : course.eventStart ? eventDays(course.eventStart, course.eventEnd) : "";
            const open = !locked && lesson.ready;
            return (
              <Pressable
                key={lesson.id}
                accessibilityRole="button"
                accessibilityLabel={`${lesson.title}${who ? `，${who}` : ""}`}
                onPress={() => router.push(open ? `/learn/${course.id}/${lesson.id}` : `/course/${course.id}`)}
                style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <View style={styles.thumb}>
                  {lesson.coverUrl || course.coverUrl || course.edmUrl ? (
                    <Image source={{ uri: resolveUrl((lesson.coverUrl || course.coverUrl || course.edmUrl) as string) }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <CourseCover theme={course.theme} label="" title={course.series || course.title} fill />
                  )}
                </View>
                <View style={styles.mid}>
                  <AppText variant="callout" style={{ fontWeight: "800" }} numberOfLines={2}>
                    {lesson.title}
                  </AppText>
                  {who ? (
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {who}
                    </AppText>
                  ) : null}
                  <View style={styles.meta}>
                    <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {[date, lesson.minutes ? `${lesson.minutes} 分鐘` : ""].filter(Boolean).join(" · ")}
                    </AppText>
                    {course.title !== g.title ? (
                      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: "45%" }}>
                        {course.title}
                      </AppText>
                    ) : null}
                  </View>
                  {lesson.completed ? (
                    <View style={[styles.chip, { backgroundColor: c.accentSoft }]}>
                      <Ionicons name="checkmark-circle" size={14} color={c.accentText} />
                      <AppText variant="caption" style={{ color: c.accentText, fontWeight: "700" }}>
                        已完成
                      </AppText>
                    </View>
                  ) : !lesson.ready ? (
                    <AppText variant="caption" tone="muted">
                      敬請期待
                    </AppText>
                  ) : locked ? (
                    <View style={styles.lock}>
                      <Ionicons name="lock-closed-outline" size={13} color={c.textMuted} />
                      <AppText variant="caption" tone="muted">
                        報名後觀看
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm, marginTop: space.md, marginBottom: space.xs, paddingHorizontal: 2 },
  row: { flexDirection: "row", gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.sm, marginBottom: space.sm },
  thumb: { width: 96, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: "hidden", backgroundColor: "#00000010", alignSelf: "flex-start" },
  mid: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 2 },
  lock: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
});
