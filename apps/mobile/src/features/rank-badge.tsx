import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from "react-native";
import { resolveUrl } from "@/api/client";

/** 徽章高度：108（業主 2026-11-14：先放大 1.5 倍到 72，再放大 1.5 倍到 108）。圖是直式（380×720），寬度依比例。要改大小只改這裡，閃光球大小會跟著縮放。 */
export const BADGE_SIZE = 108;
const K = BADGE_SIZE / 72; // 閃光球的大小以 72 高為基準，隨徽章等比縮放
const BADGE_W = Math.round((BADGE_SIZE * 380) / 720);

/** 各徽章圖案在 720 高畫布裡的上下範圍（像素；量自 24 張圖）。閃光球只出現在圖案上。 */
const ART_Y: Record<string, [number, number]> = {
  "01": [257, 463], "02": [235, 488], "03": [235, 488], "04": [181, 552], "05": [167, 564], "06": [181, 552], "07": [167, 564],
  "08": [167, 564], "09": [167, 564], "10": [167, 564], "11": [167, 564], "12": [167, 564], "13": [137, 593], "14": [137, 593],
  "15": [137, 593], "16": [138, 594], "17": [138, 594], "18": [138, 594], "19": [137, 593], "20": [138, 594], "21": [70, 659],
  "22": [70, 659], "23": [32, 694], "24": [32, 694],
};
/** 閃光球的位置（圖案範圍內的比例 x、y）、大小、出現時間點。多顆錯開，像星星此起彼落地閃。 */
const SPARKS = [
  { x: 0.28, y: 0.12, size: 15, delay: 0, period: 2600 },
  { x: 0.74, y: 0.42, size: 12, delay: 900, period: 3000 },
  { x: 0.36, y: 0.74, size: 14, delay: 1700, period: 2800 },
  { x: 0.8, y: 0.9, size: 10, delay: 2300, period: 3200 },
];

/** 一顆星形閃光球：中心亮點＋十字與斜十字的細光芒＋柔和光暈。 */
function Spark({ cx, cy, size, delay, period, still }: { cx: number; cy: number; size: number; delay: number; period: number; still: boolean }) {
  const k = useRef(new Animated.Value(0)).current; // 0＝看不見，1＝最亮
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(k, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(k, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(Math.max(0, period - 680)),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, k, delay, period]);
  const scale = k.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const spin = k.interpolate({ inputRange: [0, 1], outputRange: ["-35deg", "0deg"] });
  const arm = { position: "absolute" as const, backgroundColor: "#fffdf0", borderRadius: 2 };
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size, opacity: k, transform: [{ scale }, { rotate: spin }], alignItems: "center", justifyContent: "center" }}
    >
      <View style={[styles.glow, { width: size * 0.9, height: size * 0.9, borderRadius: size }]} />
      <View style={[arm, { width: size, height: 2, top: size / 2 - 1 }]} />
      <View style={[arm, { width: 2, height: size, left: size / 2 - 1 }]} />
      <View style={[arm, { width: size * 0.62, height: 1.5, top: size / 2 - 0.75, left: size * 0.19, transform: [{ rotate: "45deg" }], opacity: 0.8 }]} />
      <View style={[arm, { width: size * 0.62, height: 1.5, top: size / 2 - 0.75, left: size * 0.19, transform: [{ rotate: "-45deg" }], opacity: 0.8 }]} />
      <View style={[styles.core, { width: size * 0.36, height: size * 0.36, borderRadius: size }]} />
    </Animated.View>
  );
}

/**
 * 獎銜徽章圖＋星星般閃爍的閃光球：在徽章圖案上，幾顆小星形光球此起彼落地亮起、旋轉、淡出。
 * 系統開啟「減少動態效果」時只顯示靜態徽章。
 */
export function RankBadge({ url, label, layoutHeight = BADGE_SIZE }: { url: string; label?: string | null; layoutHeight?: number }) {
  const [failed, setFailed] = useState(false);
  const breathe = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setStill(v)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  // 呼吸：整個徽章（含閃光球）慢慢放大再縮回，只改大小、不變半透明；不影響版面（transform 不佔位）。
  useEffect(() => {
    if (still || failed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, failed, breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  // 由網址的檔名編號（?f=13-Diamond → 13）找出圖案範圍，閃光球就落在圖案上
  const [top, bottom] = useMemo(() => ART_Y[/f=(\d\d)-/.exec(url)?.[1] ?? ""] ?? [0, 720], [url]);
  if (failed) return null;
  const y0 = (top / 720) * BADGE_SIZE;
  const artH = ((bottom - top) / 720) * BADGE_SIZE;
  return (
    // 外層只佔 layoutHeight 的高度（會員抬頭傳 48＝頭像高度，所以徽章放大後上下間距不變）；徽章本體 108 高置中，上下溢出到外面。
    <View style={{ width: BADGE_W, height: layoutHeight, overflow: "visible", alignItems: "center", justifyContent: "center" }} accessible accessibilityRole="image" accessibilityLabel={label ? `${label}徽章` : "獎銜徽章"}>
      <Animated.View style={[styles.box, { position: "absolute", top: (layoutHeight - BADGE_SIZE) / 2, transform: [{ scale }] }]}>
        <Image source={{ uri: resolveUrl(url) }} resizeMode="contain" onError={() => setFailed(true)} style={styles.img} accessibilityIgnoresInvertColors />
        {!still ? SPARKS.map((s, i) => <Spark key={i} cx={s.x * BADGE_W} cy={y0 + s.y * artH} size={s.size * K} delay={s.delay} period={s.period} still={still} />) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: BADGE_W, height: BADGE_SIZE },
  img: { width: BADGE_W, height: BADGE_SIZE },
  glow: { position: "absolute", backgroundColor: "rgba(255,236,150,0.55)", shadowColor: "#ffd54a", shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  core: { position: "absolute", backgroundColor: "#ffffff", shadowColor: "#fff3b0", shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
});
