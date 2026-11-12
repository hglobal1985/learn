import { router } from "expo-router";
import { useState } from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { resolveUrl, type CourseSummary } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { courseThemes, radius, space } from "@/theme/tokens";
import { AppText } from "@/ui";
import { CoursePriceTag } from "./course-card";

/** 左右兩欄是直式，所以只顯示 EDM 本身（直式 5:7）；沒有上傳 EDM 就用課程名稱當封面。高度最多 340，避免電腦寬螢幕撐出捲軸。 */
function frameOf(width: number) {
  const h = Math.min(Math.round((width * 7) / 5), 340);
  return { w: Math.round((h * 5) / 7), h };
}
function Slide({ course, width }: { course: CourseSummary; width: number }) {
  const { scheme } = useTheme();
  const [bg, fg] = (courseThemes[course.theme] ?? courseThemes.sage)[scheme];
  const { w, h } = frameOf(width);
  return (
    <View style={{ width, alignItems: "center" }}>
      {course.edmUrl ? (
        <Image source={{ uri: resolveUrl(course.edmUrl) }} style={{ width: w, height: h, borderRadius: radius.md, backgroundColor: bg }} resizeMode="contain" accessibilityLabel={`${course.title} 海報`} />
      ) : (
        <View style={{ width: w, height: h, borderRadius: radius.md, backgroundColor: bg, padding: space.md, justifyContent: "center" }}>
          <AppText variant="headline" numberOfLines={6} style={{ color: fg, fontWeight: "700", textAlign: "center" }}>
            {course.title}
          </AppText>
        </View>
      )}
    </View>
  );
}

/**
 * 首頁的一個區塊（左或右）：直式海報（EDM）的橫向輪播，手指在區塊內左右滑動切換課程；
 * 下方顯示目前這門課的名稱與資訊，點圖或名稱進入課程。
 */
export function HomeRail({ title, note, courses, empty, progress }: { title: string; note?: string; courses: CourseSummary[]; empty: React.ReactNode; progress?: boolean }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const cur = courses[Math.min(page, Math.max(0, courses.length - 1))];
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => width && setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  return (
    <View style={styles.col} onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
      <View style={styles.head}>
        <AppText variant="headline" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </AppText>
      </View>
      {note ? (
        <AppText variant="caption" tone="muted" numberOfLines={3} style={{ minHeight: 32 }}>
          {note}
        </AppText>
      ) : null}
      {!courses.length || !width ? (
        <View style={{ minHeight: width ? Math.min(Math.round((width * 7) / 5), 340) : 90, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: space.sm, justifyContent: "center", gap: space.xs }}>{empty}</View>
      ) : (
        <>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} onScroll={onEnd} scrollEventThrottle={64} nestedScrollEnabled style={{ width }} contentContainerStyle={{ gap: 0 }}>
            {courses.map((course) => (
              <Pressable key={course.id} onPress={() => router.push(`/course/${course.id}`)} accessibilityRole="button" accessibilityLabel={course.title} style={{ width }}>
                <Slide course={course} width={width} />
              </Pressable>
            ))}
          </ScrollView>
          {courses.length > 1 ? (
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {courses.map((course, i) => (
                <View key={course.id} style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]} />
              ))}
            </View>
          ) : null}
          {cur ? (
            <Pressable onPress={() => router.push(`/course/${cur.id}`)} accessibilityRole="link" style={{ gap: 2 }}>
              <AppText variant="callout" numberOfLines={2} style={{ fontWeight: "700" }}>
                {cur.title}
              </AppText>
              {cur.hostUnit ? (
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  主辦：{cur.hostUnit.split(/[、,，;；\n]+/).filter(Boolean).join("、")}
                </AppText>
              ) : null}
              {cur.nextRunAt ? (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  日期：{cur.nextRunAt.slice(0, 10)}
                </AppText>
              ) : null}
              <CoursePriceTag course={cur} />
              {progress && cur.lessonCount ? (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  已完成 {cur.completedLessons}/{cur.lessonCount} 堂
                </AppText>
              ) : null}
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, minWidth: 0, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 32 },
  more: { minHeight: 32, justifyContent: "center", paddingHorizontal: space.xs },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
