import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";

/** 寰宇 logo 的色系：深綠 → 橄欖 → 橘 → 金黃 → 鮭粉 → 回到深綠。淺色模式用較深的色階、深色模式用較亮的色階。 */
const LIGHT = ["#14663f", "#486c48", "#cc6c0c", "#e09a10", "#e0734a", "#14663f"];
const DARK = ["#5fcf94", "#9bc79b", "#f0a050", "#f2dc27", "#f4a884", "#5fcf94"];
const TEXT = "寰宇行動大學";

/**
 * 首頁大標題：每個字依序做「色彩流動＋輕輕彈跳」的循環動畫（色系取自寰宇 logo），logo 同步緩慢呼吸旋光。
 * 只用 Animated，網頁與 iOS／Android 都能跑。
 */
export function BrandTitle() {
  const { scheme } = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const palette = scheme === "dark" ? DARK : LIGHT;
  const n = TEXT.length;
  const logoScale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] });
  const logoRotate = t.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "6deg"] });
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="寰宇行動大學">
      <Animated.View style={{ transform: [{ scale: logoScale }, { rotate: logoRotate }] }}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[...TEXT].map((ch, i) => {
          // 每個字的相位錯開，顏色像波浪一樣從左流到右
          const steps = palette.length;
          const input = Array.from({ length: steps }, (_, s) => s / (steps - 1));
          const color = t.interpolate({ inputRange: input, outputRange: palette.map((_, s) => palette[(s + Math.round((i / n) * (steps - 1))) % (steps - 1)]) });
          const bounce = t.interpolate({
            inputRange: [0, Math.min(0.99, i / n / 1.2), Math.min(0.995, i / n / 1.2 + 0.08), Math.min(0.999, i / n / 1.2 + 0.16), 1],
            outputRange: [0, 0, -7, 0, 0],
          });
          return (
            <Animated.Text key={i} style={[styles.ch, { color, transform: [{ translateY: bounce }] }]}>
              {ch}
            </Animated.Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs },
  logo: { width: 52, height: 52 },
  ch: { fontSize: 30, lineHeight: 40, fontWeight: "800", letterSpacing: 1 },
});
