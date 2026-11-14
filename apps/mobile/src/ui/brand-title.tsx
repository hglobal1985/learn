import { useFonts } from "expo-font";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";

/** 寰宇 logo 的色系：深綠 → 橄欖 → 橘 → 金黃 → 鮭粉 → 回到深綠。淺色模式用較深的色階、深色模式用較亮的色階。 */
const LIGHT = ["#0c603c", "#486c48", "#cc6c0c", "#a86408", "#486c48", "#0c603c"]; // 規範色：主綠、橄欖、橘、警示橘褐
const DARK = ["#cee49f", "#8fae78", "#f0a050", "#f2c063", "#8fae78", "#cee49f"]; // 規範深色模式色階
const TEXT = "寰宇行動大學";
const STEPS = 48; // 動畫取樣點數（越多越平順）
/** 標題用極細字體：Noto Sans TC Thin（SIL OFL 授權），只含標題這 6 個字（約 3KB），網頁與 App 都內建，不依賴手機系統字型。 */
const THIN_FONT = "BrandThin";

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** 第 i 個字在時間 t（0～1）的顏色：基底色沿 logo 色系流動，再疊上一道由左掃到右的「反光」（顏色被拉向白色）。 */
function colorAt(palette: string[], shine: number[], t: number, i: number, n: number): { color: string; glow: number } {
  const u = (t + (i / n) * 0.6) % 1;
  const pos = u * (palette.length - 1);
  const k = Math.min(Math.floor(pos), palette.length - 2);
  const base = mix(hex(palette[k]), hex(palette[k + 1]), pos - k);
  const x = i / (n - 1);
  const center = t * 1.5 - 0.25; // 反光帶的位置：從左側外面掃到右側外面
  const glint = Math.max(0, 1 - Math.abs(x - center) / 0.2);
  return { color: rgb(mix(base, shine, 0.9 * glint)), glow: glint };
}

/**
 * 首頁大標題：每個字的色彩沿 logo 色系緩慢流動，並週期性掃過一道由左到右的反光；logo 同步呼吸。
 * 只用 Animated，網頁與 iOS／Android 都能跑；沒有位移（不會跳動）。
 */
export function BrandTitle() {
  const { scheme } = useTheme();
  const [fontReady] = useFonts({ [THIN_FONT]: require("../../assets/fonts/NotoSansTC-Thin-brand.ttf") });
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const palette = scheme === "dark" ? DARK : LIGHT;
  // 反光色：深色模式用白光；淺色模式背景是米白，白光會看不見，改用亮金色。
  const shine = useMemo(() => (scheme === "dark" ? [255, 255, 255] : [242, 220, 39]), [scheme]);
  const n = TEXT.length;
  const input = useMemo(() => Array.from({ length: STEPS + 1 }, (_, s) => s / STEPS), []);
  const letters = useMemo(
    () =>
      [...TEXT].map((ch, i) => {
        const samples = input.map((p) => colorAt(palette, shine, p, i, n));
        return { ch, color: samples.map((s) => s.color), glow: samples.map((s) => s.glow * 12) };
      }),
    [palette, shine, input, n],
  );
  const logoScale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="寰宇行動大學">
      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
      </Animated.View>
      <View style={[styles.letters, { opacity: fontReady ? 1 : 0 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {letters.map((l, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.ch,
              {
                color: t.interpolate({ inputRange: input, outputRange: l.color }),
                textShadowColor: scheme === "dark" ? "rgba(255,255,255,0.95)" : "rgba(255,196,0,0.9)",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: t.interpolate({ inputRange: input, outputRange: l.glow }),
              },
            ]}
          >
            {l.ch}
          </Animated.Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs },
  logo: { width: 52, height: 52 },
  letters: { flexDirection: "row", alignItems: "center", justifyContent: "center" }, // 字與字貼近：不加 gap
  ch: { fontFamily: THIN_FONT, fontSize: 32, lineHeight: 42, fontWeight: "normal", letterSpacing: 2 },
});
