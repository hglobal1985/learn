import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveUrl } from "@/api/client";
import { useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
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

/**
 * 「全部課程」的小卡片：只有 EDM＋「選擇梯次」下拉。
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
      <Pressable accessibilityRole="button" accessibilityLabel={`${inSeries ? rep.series : rep.title}，選擇梯次`} onPress={open} style={[styles.art, { width, height, backgroundColor: c.surfaceMuted }]}>
        {edm ? <TopFill uri={resolveUrl(edm)} w={width} h={height} /> : <CourseCover theme={rep.theme} label={rep.category} title={inSeries ? rep.series : rep.title} fill />}
        {ribbons.left ? <CornerRibbon label={ribbons.left.label} bg={ribbons.left.bg} fg={ribbons.left.fg} side="left" scale={0.8} /> : null}
        {ribbons.right ? <CornerRibbon label={ribbons.right.label} bg={ribbons.right.bg} fg={ribbons.right.fg} side="right" scale={0.8} /> : null}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={open} style={[styles.pick, { borderColor: c.accent }]}>
        <AppText variant="callout" style={{ color: c.accent, fontWeight: "700", flex: 1 }} numberOfLines={1}>
          選擇梯次
        </AppText>
        <Ionicons name="chevron-down" size={18} color={c.accent} />
      </Pressable>
      {sheet ? <SeriesSheet title={inSeries ? rep.series : rep.title} items={group.sessions} showAllSeries={inSeries ? rep.series : undefined} onClose={() => setSheet(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { borderRadius: radius.md, overflow: "hidden" },
  pick: { flexDirection: "row", alignItems: "center", minHeight: minTouch, marginTop: space.xs, paddingHorizontal: space.md, borderWidth: 1.5, borderRadius: radius.md },
});
