import { Image, StyleSheet, View } from "react-native";
import { resolveUrl } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { courseThemes, radius, space } from "@/theme/tokens";
import { AppText } from "./text";

/**
 * 課程封面（課程清單縮圖）：有 16:9 封面圖就顯示圖片（管理員從 EDM 裁切出來的）；
 * 沒有就顯示原創色塊（不引用他站素材）。fill＝填滿父層（課程介紹頁上方沒有 EDM 時用）。
 */
export function CourseCover({ theme, label, height = 120, imageUrl, fill }: { theme: string; label: string; height?: number; imageUrl?: string | null; fill?: boolean }) {
  const { scheme } = useTheme();
  if (imageUrl) {
    return <Image source={{ uri: resolveUrl(imageUrl) }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md }} resizeMode="cover" accessibilityLabel={`${label}課程封面`} />;
  }
  const [bg, fg] = (courseThemes[theme] ?? courseThemes.sage)[scheme];
  return (
    <View style={[styles.cover, fill ? [StyleSheet.absoluteFill, { borderRadius: 0 }] : { height }, { backgroundColor: bg }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
