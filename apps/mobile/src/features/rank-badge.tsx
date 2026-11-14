import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from "react-native";
import { resolveUrl } from "@/api/client";

/** 徽章高度：與會員大頭照同高（48）。圖是直式（380×720），寬度依比例。要改大小只改這裡。 */
export const BADGE_SIZE = 48;
const BADGE_W = Math.round((BADGE_SIZE * 380) / 720);
const BAND = 9; // 反光帶寬度
const SWEEP_MS = 800; // 一次掃過的時間
const PAUSE_MS = 2600; // 兩次反光之間的停頓

/**
 * 獎銜徽章圖＋反光閃爍：一道亮帶定期由左掃到右（只照在徽章圖案上，透明處不會亮），
 * 掃過後徽章整體微微閃一下。系統開啟「減少動態效果」時只顯示靜態徽章。
 * 做法：用同一張圖染成白色，只露出「移動中的窄窗」那一段（窗往右、圖往左等量反向移動，所以圖始終對齊徽章）。
 */
export function RankBadge({ url, label }: { url: string; label?: string | null }) {
  const [failed, setFailed] = useState(false);
  const [still, setStill] = useState(false);
  const x = useRef(new Animated.Value(-BAND)).current;
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setStill(v)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (still || failed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(PAUSE_MS),
        Animated.timing(x, { toValue: BADGE_W, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(x, { toValue: -BAND, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, failed, x, twinkle]);

  if (failed) return null;
  const src = { uri: resolveUrl(url) };
  const counter = Animated.multiply(x, -1); // 圖與窗反向等量移動
  return (
    <View style={styles.box} accessible accessibilityRole="image" accessibilityLabel={label ? `${label}徽章` : "獎銜徽章"}>
      <Image source={src} resizeMode="contain" onError={() => setFailed(true)} style={styles.img} accessibilityIgnoresInvertColors />
      {!still ? (
        <>
          {/* 整體微閃 */}
          <Animated.Image source={src} resizeMode="contain" style={[styles.img, styles.fill, { tintColor: "#ffffff", opacity: Animated.multiply(twinkle, 0.35) }]} accessibilityIgnoresInvertColors />
          {/* 掃過的亮帶 */}
          <Animated.View pointerEvents="none" style={[styles.window, { transform: [{ translateX: x }] }]}>
            <Animated.Image source={src} resizeMode="contain" style={[styles.img, { position: "absolute", top: 0, left: 0, tintColor: "#ffffff", opacity: 0.85, transform: [{ translateX: counter }] }]} accessibilityIgnoresInvertColors />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: BADGE_W, height: BADGE_SIZE },
  img: { width: BADGE_W, height: BADGE_SIZE },
  fill: { position: "absolute", top: 0, left: 0 },
  window: { position: "absolute", top: 0, left: 0, width: BAND, height: BADGE_SIZE, overflow: "hidden" },
});
