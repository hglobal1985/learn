import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { resolveUrl, type CourseSummary } from "@/api/client";
import { eventDays } from "@/features/format";
import { useTheme } from "@/theme/theme";
import { courseThemes, radius, space } from "@/theme/tokens";
import { AppText, Icon, type IconName } from "@/ui";
import { CoursePriceTag } from "./course-card";

/** EDM 填滿整個框（不留空白）、靠上對齊：先依寬度放大，不夠高再依高度放大；只會裁到下方與左右，不會裁到上方文字。 */
function TopFillImage({ uri, w, h }: { uri: string; w: number; h: number }) {
  const [ratio, setRatio] = useState<number | null>(null); // 寬 / 高
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (iw, ih) => alive && ih && setRatio(iw / ih), () => undefined);
    return () => {
      alive = false;
    };
  }, [uri]);
  const r = ratio ?? 0.7;
  const iw = Math.max(w, h * r);
  const ih = iw / r;
  return (
    <View style={{ width: w, height: h, overflow: "hidden", borderRadius: radius.md }}>
      <Image source={{ uri }} resizeMode="stretch" style={{ position: "absolute", top: 0, left: (w - iw) / 2, width: iw, height: ih }} accessibilityLabel="課程海報" />
    </View>
  );
}

function Slide({ course, w, h }: { course: CourseSummary; w: number; h: number }) {
  const { scheme } = useTheme();
  const [bg, fg] = (courseThemes[course.theme] ?? courseThemes.sage)[scheme];
  return course.edmUrl ? (
    <TopFillImage uri={resolveUrl(course.edmUrl)} w={w} h={h} />
  ) : (
    <View style={{ width: w, height: h, borderRadius: radius.md, backgroundColor: bg, padding: space.md, justifyContent: "center" }}>
      <AppText variant="headline" numberOfLines={8} style={{ color: fg, fontWeight: "700", textAlign: "center" }}>
        {course.title}
      </AppText>
    </View>
  );
}

/**
 * 首頁的一個區塊（左或右）：標題與備註置中；海報（EDM）區塊填滿剩下的高度，手指在區塊內左右滑動切換；
 * 下方顯示目前這門課的名稱、主辦單位、日期、金額，點圖或名稱進入課程。
 */
export function HomeRail({ title, icon, tone, note, courses, empty, progress }: { title: string; icon: IconName; tone: "green" | "orange"; note?: string; courses: CourseSummary[]; empty: React.ReactNode; progress?: boolean }) {
  const { c } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(0);
  const cur = courses[Math.min(page, Math.max(0, courses.length - 1))];
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => box.w && setPage(Math.round(e.nativeEvent.contentOffset.x / box.w));
  const [bg, fg] = tone === "green" ? [c.accentSoft, c.accentText] : [c.warningSoft, c.warning];
  return (
    <View style={styles.col}>
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <Icon name={icon} size={18} color={fg} />
        <AppText variant="headline" numberOfLines={1} style={{ color: fg, fontWeight: "800" }}>
          {title}
        </AppText>
      </View>
      {note ? (
        <AppText variant="caption" tone="muted" numberOfLines={3} style={styles.note}>
          {note}
        </AppText>
      ) : null}
      <View style={styles.stage} onLayout={(e) => setBox({ w: Math.floor(e.nativeEvent.layout.width), h: Math.floor(e.nativeEvent.layout.height) })}>
        {box.w > 0 && box.h > 0 ? (
          courses.length ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} onScroll={onEnd} scrollEventThrottle={64} nestedScrollEnabled style={{ width: box.w, height: box.h }}>
              {courses.map((course) => (
                <Pressable key={course.id} onPress={() => router.push(`/course/${course.id}`)} accessibilityRole="button" accessibilityLabel={course.title} style={{ width: box.w, height: box.h }}>
                  <Slide course={course} w={box.w} h={box.h} />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={{ width: box.w, height: box.h, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: space.sm, justifyContent: "center", gap: space.xs }}>{empty}</View>
          )
        ) : null}
      </View>
      {courses.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {courses.map((course, i) => (
            <View key={course.id} style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]} />
          ))}
        </View>
      ) : null}
      {cur ? (
        <Pressable onPress={() => router.push(`/course/${cur.id}`)} accessibilityRole="link" style={styles.info}>
          <AppText variant="callout" numberOfLines={2} style={{ fontWeight: "700" }}>
            {cur.title}
          </AppText>
          {cur.hostUnit ? (
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              主辦：{cur.hostUnit.split(/[、,，;；\n]+/).filter(Boolean).join("、")}
            </AppText>
          ) : null}
          {cur.eventStart || cur.nextRunAt ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              日期：{cur.eventStart ? eventDays(cur.eventStart, cur.eventEnd) : cur.nextRunAt!.slice(0, 10)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, minWidth: 0, gap: space.xs, alignItems: "stretch" },
  pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.pill },
  note: { textAlign: "center", minHeight: 32 },
  stage: { flex: 1, minHeight: 120 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  info: { gap: 2, alignItems: "center" },
});
