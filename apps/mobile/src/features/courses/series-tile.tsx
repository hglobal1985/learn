import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { resolveUrl } from "@/api/client";
import { useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, CornerRibbon, CourseCover } from "@/ui";
import { ribbonsFor } from "./ribbons";
import { SeriesSheet } from "./series-sheet";
import type { SeriesGroup } from "./sort";

/** EDM 填滿方框、靠上對齊（先依寬度放大，不夠高再依高度放大）。 */
function TopFill({ uri, w, h }: { uri: string; w: number; h: number }) {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (iw, ih) => alive && ih && setRatio(iw / ih), () => alive && setRatio(0.7));
    return () => {
      alive = false;
    };
  }, [uri]);
  const r = ratio ?? 0.7;
  const iw = Math.max(w, h * r);
  const ih = iw / r;
  return <Image source={{ uri }} resizeMode="stretch" style={{ position: "absolute", top: 0, left: (w - iw) / 2, width: iw, height: ih }} accessibilityIgnoresInvertColors />;
}

/** 封面下緣的暗色漸層＋白字「瀏覽細節 ›」（整張封面就是按鈕，不佔額外高度）。 */
function BrowseHint({ height }: { height: number }) {
  return (
    <View pointerEvents="none" style={[styles.hint, { height }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="browse-hint" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#browse-hint)" />
      </Svg>
      <AppText variant="callout" style={styles.hintText} numberOfLines={1}>
        瀏覽細節 ›
      </AppText>
    </View>
  );
}

/**
 * 「全部課程」的小卡片：只有 EDM（封面下緣疊「瀏覽細節 ›」）。
 * 有系列＝顯示系列的專屬 EDM，沒上傳就用系列名稱當大標題；沒有系列＝顯示課程自己的 EDM（沒有就用課程名稱）。
 * 緞帶仍然顯示，文字以日期最近的那一梯為準。不顯示任何課程資訊欄位。
 */
export function SeriesTile({ group, width }: { group: SeriesGroup; width: number }) {
  const { c } = useTheme();
  const { member } = useSession();
  const { config } = useUiConfig();
  const [sheet, setSheet] = useState(false);
  const rep = group.nearest;
  const height = Math.round((width * 9) / 16); // 16:9
  const inSeries = !!rep.series;
  const edm = inSeries ? rep.seriesEdmUrl : rep.edmUrl;
  const ribbons = ribbonsFor(rep, member, config);
  const open = () => (group.sessions.length > 1 || inSeries ? setSheet(true) : router.push(`/course/${rep.id}`));
  return (
    <View style={{ width }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${inSeries ? rep.series : rep.title}，瀏覽細節`} onPress={open} style={[styles.art, { width, height, backgroundColor: c.surfaceMuted }]}>
        {edm ? <TopFill uri={resolveUrl(edm)} w={width} h={height} /> : <CourseCover theme={rep.theme} label={rep.category} title={inSeries ? rep.series : rep.title} fill />}
        {ribbons.left ? <CornerRibbon label={ribbons.left.label} bg={ribbons.left.bg} fg={ribbons.left.fg} side="left" scale={0.8} /> : null}
        {ribbons.right ? <CornerRibbon label={ribbons.right.label} bg={ribbons.right.bg} fg={ribbons.right.fg} side="right" scale={0.8} /> : null}
        <BrowseHint height={Math.round(height * 0.45)} />
      </Pressable>
      {sheet ? <SeriesSheet title={inSeries ? rep.series : rep.title} items={group.sessions} showAllSeries={inSeries ? rep.series : undefined} onClose={() => setSheet(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { borderRadius: radius.md, overflow: "hidden" },
  hint: { position: "absolute", left: 0, right: 0, bottom: 0, justifyContent: "flex-end", alignItems: "flex-end", paddingHorizontal: space.sm, paddingBottom: 5 },
  hintText: { color: "#fff", fontWeight: "800", fontSize: 13, lineHeight: 18 },
});
