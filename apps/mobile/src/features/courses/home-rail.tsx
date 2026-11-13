import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, PanResponder, Platform, Pressable, StyleSheet, View } from "react-native";
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
    <View style={{ width: w, height: h, borderRadius: radius.md, backgroundColor: bg, padding: space.md, justifyContent: "center", alignItems: "center", gap: space.md, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: -w * 0.25, top: -w * 0.25, width: w * 0.8, height: w * 0.8, borderRadius: w * 0.4, borderWidth: w * 0.1, borderColor: fg, opacity: 0.18 }} />
      <View style={{ position: "absolute", left: -w * 0.3, bottom: -w * 0.3, width: w * 0.7, height: w * 0.7, borderRadius: w * 0.35, backgroundColor: fg, opacity: 0.1 }} />
      <Icon name="school-outline" size={30} color={fg} />
      <AppText variant="headline" numberOfLines={6} style={{ color: fg, fontWeight: "800", textAlign: "center" }}>
        {course.title}
      </AppText>
      {course.category ? (
        <AppText variant="caption" style={{ color: fg, opacity: 0.8, letterSpacing: 1 }}>
          {course.category}
        </AppText>
      ) : null}
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
  const x = useRef(new Animated.Value(0)).current;
  const live = useRef({ page: 0, w: 0, n: 0 });
  live.current = { page, w: box.w, n: courses.length };
  const slideTo = (i: number) => {
    const { w } = live.current;
    setPage(i);
    Animated.timing(x, { toValue: -i * w, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  };
  // 資料或寬度變動時，回到合法的頁面。
  useEffect(() => {
    const i = Math.min(page, Math.max(0, courses.length - 1));
    if (i !== page) setPage(i);
    x.setValue(-i * box.w);
  }, [box.w, courses.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // 手指左右滑：不管拖多大力、多快，放手後最多只翻一張（往左滑＝下一張、往右滑＝上一張）。
  const pan = useMemo(() => {
    let start = 0;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderGrant: () => {
        x.stopAnimation((v) => (start = v));
      },
      onPanResponderMove: (_e, g) => {
        const { w, n } = live.current;
        const min = -(n - 1) * w;
        let v = start + g.dx;
        if (v > 0) v *= 0.3;
        if (v < min) v = min + (v - min) * 0.3;
        // 一次最多拖一張的距離
        const base = -live.current.page * w;
        v = Math.max(base - w, Math.min(base + w, v));
        x.setValue(v);
      },
      onPanResponderRelease: (_e, g) => {
        const { w, n, page: p } = live.current;
        let next = p;
        if (g.dx < -w * 0.18 || g.vx < -0.4) next = p + 1;
        else if (g.dx > w * 0.18 || g.vx > 0.4) next = p - 1;
        slideTo(Math.max(0, Math.min(n - 1, next)));
      },
      onPanResponderTerminate: () => slideTo(live.current.page),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const goTo = (i: number) => slideTo(i);
  const [bg, fg] = tone === "green" ? [c.accentSoft, c.accentText] : [c.warningSoft, c.warning];
  return (
    <View style={styles.col}>
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <Icon name={icon} size={18} color={fg} />
        <AppText variant="headline" numberOfLines={1} style={{ color: fg, fontWeight: "800" }}>
          {title}
        </AppText>
      </View>
      <AppText variant="caption" tone="muted" numberOfLines={3} style={styles.note}>
        {note ?? " "}
      </AppText>
      <View style={styles.stage} onLayout={(e) => setBox({ w: Math.floor(e.nativeEvent.layout.width), h: Math.floor(e.nativeEvent.layout.height) })}>
        {box.w > 0 && box.h > 0 ? (
          courses.length ? (
            <View style={{ width: box.w, height: box.h, overflow: "hidden", ...(Platform.OS === "web" ? ({ touchAction: "pan-y", userSelect: "none" } as object) : {}) }} {...pan.panHandlers}>
              <Animated.View style={{ flexDirection: "row", width: box.w * courses.length, height: box.h, transform: [{ translateX: x }] }}>
                {courses.map((course) => (
                  <Pressable key={course.id} onPress={() => router.push(`/course/${course.id}`)} accessibilityRole="button" accessibilityLabel={course.title} style={{ width: box.w, height: box.h }}>
                    <Slide course={course} w={box.w} h={box.h} />
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          ) : (
            <View style={{ width: box.w, height: box.h, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderStyle: "dashed", padding: space.sm, justifyContent: "center", alignItems: "center", gap: space.sm }}>
              <Icon name={icon} size={34} color={c.textMuted} />
              {empty}
            </View>
          )
        ) : null}
      </View>
      <View style={styles.dots}>
        {courses.length > 1
          ? courses.map((course, i) => (
              <Pressable key={course.id} onPress={() => goTo(i)} accessibilityRole="button" accessibilityLabel={`第 ${i + 1} 張，共 ${courses.length} 張`} accessibilityState={{ selected: i === page }} hitSlop={4} style={styles.dotHit}>
                <View style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]} />
              </Pressable>
            ))
          : null}
      </View>
      {!cur ? <View style={styles.info} /> : null}
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
          {cur.location && !cur.locationNone ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              地點：{cur.location}
            </AppText>
          ) : null}
          <View style={{ alignSelf: "center" }}>
            <CoursePriceTag course={cur} />
          </View>
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
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", height: 26 },
  dotHit: { width: 16, height: 26, alignItems: "center", justifyContent: "center", ...(Platform.OS === "web" ? ({ cursor: "pointer" } as object) : {}) },
  dot: { width: 11, height: 11, borderRadius: 6 },
  info: { gap: 2, alignItems: "center", minHeight: 112 },
});
