import { Image, StyleSheet, View } from "react-native";
import { resolveUrl } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { courseThemes, radius, space } from "@/theme/tokens";
import { AppText } from "./text";

/**
 * 課程橫幅：有 EDM 時，系統自動把 EDM 模糊並放大到橫幅的最大寬度當底圖，EDM 本身清楚地置中疊在上面；
 * 沒有 EDM 時顯示原創色塊（不引用他站素材）。
 */
export function CourseCover({ theme, label, height = 120, edmUrl }: { theme: string; label: string; height?: number; edmUrl?: string | null }) {
  const { scheme } = useTheme();
  if (edmUrl) {
    const uri = resolveUrl(edmUrl);
    return (
      <View style={[styles.cover, { height, backgroundColor: "#222", padding: 0 }]} accessibilityLabel={`${label}課程橫幅`}>
        <Image source={{ uri }} blurRadius={24} resizeMode="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.25 }] }]} accessibilityIgnoresInvertColors />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.18)" }]} />
        <Image source={{ uri }} resizeMode="contain" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors accessibilityLabel="課程海報" />
      </View>
    );
  }
  const [bg, fg] = (courseThemes[theme] ?? courseThemes.sage)[scheme];
  return (
    <View style={[styles.cover, { backgroundColor: bg, height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.ring, { borderColor: fg }]} />
      <AppText variant="caption" style={{ color: fg, letterSpacing: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.md, padding: space.md, justifyContent: "flex-end", overflow: "hidden" },
  ring: { position: "absolute", right: -24, top: -24, width: 110, height: 110, borderRadius: 55, borderWidth: 14, opacity: 0.35 },
});
