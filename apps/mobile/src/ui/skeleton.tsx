import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type DimensionValue } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

/** 骨架畫面的一個灰色方塊，緩慢明暗閃動，表示「內容正在載入」。 */
export function SkeletonBlock({ width = "100%", height = 16, style }: { width?: DimensionValue; height?: DimensionValue; style?: object }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }), Animated.timing(v, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ width, height, borderRadius: radius.md, backgroundColor: c.surfaceMuted, opacity: v }, style]} />;
}

/** 首頁左右兩欄的骨架：標題膠囊、備註、海報框、文字行。資料還沒回來時先顯示，不用空白或轉圈。 */
export function HomeRailsSkeleton() {
  return (
    <View style={styles.row} accessibilityLabel="載入中" accessibilityLiveRegion="polite">
      {[0, 1].map((i) => (
        <View key={i} style={styles.col}>
          <SkeletonBlock height={36} style={{ borderRadius: radius.pill }} />
          <SkeletonBlock height={14} width="80%" style={{ alignSelf: "center" }} />
          <SkeletonBlock height="100%" style={{ flex: 1, minHeight: 160 }} />
          <SkeletonBlock height={14} width="70%" style={{ alignSelf: "center" }} />
          <SkeletonBlock height={12} width="50%" style={{ alignSelf: "center" }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", gap: space.md, paddingBottom: space.sm },
  col: { flex: 1, gap: space.sm },
});
