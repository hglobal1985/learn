import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { resolveUrl } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { courseThemes, radius, space } from "@/theme/tokens";
import { AppText } from "./text";

/** 估算文字寬度（以字級為單位）：中日韓全形字算 1，英數與標點約 0.58。 */
const textUnits = (t: string) => [...t].reduce((n, ch) => n + (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 1 : 0.58), 0);

/** 找出剛好塞得進 w×h 方框的最大字級（字越少越大）；自動換行，不用 AI、不用圖片。 */
export function fitFontSize(title: string, w: number, h: number, max = 72, min = 16): number {
  const t = title.trim() || " ";
  for (let fs = max; fs > min; fs -= 2) {
    const perLine = Math.max(1, Math.floor(w / fs));
    // 逐字貪婪換行
    let lines = 1;
    let used = 0;
    for (const ch of t) {
      const u = textUnits(ch);
      if (used + u > perLine && used > 0) {
        lines++;
        used = 0;
      }
      used += u;
    }
    if (lines * fs * 1.18 <= h) return fs;
  }
  return min;
}

/**
 * 課程封面（課程清單縮圖）：有 16:9 封面圖就顯示圖片（管理員從 EDM 裁切出來的）；
 * 沒有就由系統自動產生：依「課程名稱＋分類」在主題色底上放大大的標題文字（程式排版，不是 AI 生成）。
 * fill＝填滿父層（課程介紹頁上方沒有 EDM 時用）。
 */
export function CourseCover({ theme, label, title, height = 120, imageUrl, fill }: { theme: string; label: string; title?: string; height?: number; imageUrl?: string | null; fill?: boolean }) {
  const { scheme } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (imageUrl) {
    return <Image source={{ uri: resolveUrl(imageUrl) }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md }} resizeMode="cover" accessibilityLabel={`${label}課程封面`} />;
  }
  const [bg, fg] = (courseThemes[theme] ?? courseThemes.sage)[scheme];
  const pad = space.md;
  const hasTitle = !!title?.trim();
  const tagH = label ? 26 : 0;
  const innerW = Math.max(0, box.w - pad * 2);
  const innerH = Math.max(0, box.h - pad * 2 - tagH - (label ? 6 : 0));
  const fs = hasTitle && box.w ? fitFontSize(title!, innerW, innerH) : 0;
  return (
    <View
      style={[styles.cover, fill ? [StyleSheet.absoluteFill, { borderRadius: 0 }] : { height }, { backgroundColor: bg }]}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${title ?? ""} ${label}`.trim()}
    >
      <View style={[styles.ring, { borderColor: fg }]} />
      <View style={[styles.ring2, { backgroundColor: fg }]} />
      {label ? (
        <View style={[styles.tag, { borderColor: fg }]}>
          <AppText variant="caption" style={{ color: fg, fontWeight: "800", letterSpacing: 1 }}>
            {label}
          </AppText>
        </View>
      ) : null}
      {hasTitle ? (
        <View style={styles.titleBox}>
          {fs ? (
            <AppText style={{ color: fg, fontSize: fs, lineHeight: Math.round(fs * 1.18), fontWeight: "900", textAlign: "center" }}>
              {title}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.md, padding: space.md, overflow: "hidden", gap: 6 },
  ring: { position: "absolute", right: -24, top: -24, width: 110, height: 110, borderRadius: 55, borderWidth: 14, opacity: 0.25 },
  ring2: { position: "absolute", left: -40, bottom: -40, width: 120, height: 120, borderRadius: 60, opacity: 0.1 },
  tag: { alignSelf: "center", borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, height: 26, justifyContent: "center" },
  titleBox: { flex: 1, justifyContent: "center", alignItems: "center" },
});
