import { Image, StyleSheet, View } from "react-native";
import { resolveUrl } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { courseThemes, radius, space } from "@/theme/tokens";
import { AppText } from "./text";

/** 原創色塊封面（尚無正式課程圖片時使用，不引用他站素材）。 */
export function CourseCover({ theme, label, height = 120, imageUrl }: { theme: string; label: string; height?: number; imageUrl?: string | null }) {
  const { scheme } = useTheme();
  if (imageUrl) {
    // 上傳的封面是 16:9 的合成圖；沒有圖片時才顯示原創色塊。
    return <Image source={{ uri: resolveUrl(imageUrl) }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md }} resizeMode="cover" accessibilityLabel={`${label}課程封面`} />;
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
