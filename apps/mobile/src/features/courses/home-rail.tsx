import { router } from "expo-router";
import { useState } from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { resolveUrl, type CourseSummary } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { courseThemes, radius, space } from "@/theme/tokens";
import { AppText } from "@/ui";

/** 16:9 的一張投影片：有封面（EDM 合成圖）就顯示；沒有就用課程名稱當封面。 */
function Slide({ course, width }: { course: CourseSummary; width: number }) {
  const { scheme } = useTheme();
  const [bg, fg] = (courseThemes[course.theme] ?? courseThemes.sage)[scheme];
  const h = Math.round((width * 9) / 16);
  if (course.coverUrl || course.edmUrl) {
    return <Image source={{ uri: resolveUrl((course.coverUrl ?? course.edmUrl)!) }} style={{ width, height: h, borderRadius: radius.md, backgroundColor: bg }} resizeMode={course.coverUrl ? "cover" : "contain"} accessibilityLabel={`${course.title} 封面`} />;
  }
  return (
    <View style={{ width, height: h, borderRadius: radius.md, backgroundColor: bg, padding: space.sm, justifyContent: "center" }}>
      <AppText variant="callout" numberOfLines={4} style={{ color: fg, fontWeight: "700", textAlign: "center" }}>
        {course.title}
      </AppText>
    </View>
  );
}

/**
 * 首頁的一個區塊（左或右）：16:9 的橫向輪播，手指在區塊內左右滑動切換課程；
 * 下方顯示目前這門課的名稱與資訊，點圖或名稱進入課程。
 */
export function HomeRail({ title, courses, seeAll, onSeeAll, empty, progress }: { title: string; courses: CourseSummary[]; seeAll: string; onSeeAll: () => void; empty: React.ReactNode; progress?: boolean }) {
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
        <Pressable onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`${title}：${seeAll}`} hitSlop={10} style={styles.more}>
          <AppText variant="caption" style={{ color: c.accentText, fontWeight: "700" }}>
            {seeAll}
          </AppText>
        </Pressable>
      </View>
      {!courses.length || !width ? (
        <View style={{ minHeight: width ? Math.round((width * 9) / 16) : 90, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: space.sm, justifyContent: "center", gap: space.xs }}>{empty}</View>
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
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {progress && cur.lessonCount ? `已完成 ${cur.completedLessons}/${cur.lessonCount} 堂` : cur.teacher}
              </AppText>
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
