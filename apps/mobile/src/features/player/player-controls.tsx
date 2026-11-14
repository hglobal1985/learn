import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { maxContentWidth, minTouch, space } from "@/theme/tokens";
import { AppText } from "@/ui";
import { engine } from "./engine";
import { formatClock, rateText, segmentOf } from "./engine.types";
import { SeekBar } from "./seek-bar";
import { usePlayer } from "./use-player";

/**
 * 課程頁的播放控制列：Mux 影片、YouTube、純音檔三種「共用同一個元件」，
 * 位置在影片的外面下方（不在影片裡面）。播放／暫停、可拖曳的時間軸、時間、（影片才有）全螢幕。
 * 以後要改時間軸的外觀或位置，只改這個檔案（與 seek-bar.tsx），三種模式會自動一起變。
 */
export function PlayerControls() {
  const { c } = useTheme();
  const s = usePlayer();
  const t = s.track;
  if (!t) return null;
  const { start, end } = segmentOf(t);
  const total = Math.max(0, (end ?? s.duration) - start);
  const at = Math.min(total, Math.max(0, s.position - start));
  const icon = s.loading && !s.playing ? "hourglass-outline" : s.playing ? "pause" : "play";
  return (
    <View style={[styles.outer, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <View style={styles.box}>
        <Pressable accessibilityRole="button" accessibilityLabel={s.playing ? "暫停" : "播放"} onPress={() => engine.toggle()} style={styles.btn}>
          <Ionicons name={icon} size={24} color={c.text} />
        </Pressable>
        <View style={styles.bar}>
          <SeekBar value={at} max={total || 1} onSeek={(v) => engine.seek(start + v)} onTouch={t.mode === "audio" ? undefined : () => engine.pokeHint()} />
        </View>
        <AppText variant="caption" tone="muted" style={styles.time}>
          {formatClock(at)}
        </AppText>
        {/* 倍數播放：每按一次跳一檔（1 → 1.2 → 1.5 → 1.8 → 2 → 1）；正常速度顯示加速圖示，加速中改顯示目前倍數。 */}
        <Pressable accessibilityRole="button" accessibilityLabel={`播放速度，目前 ${s.rate} 倍，點一下切換`} onPress={() => engine.cycleRate()} style={styles.btn}>
          {s.rate === 1 ? (
            <Ionicons name="speedometer-outline" size={24} color={c.text} />
          ) : (
            <AppText variant="callout" style={{ color: c.accentText, fontWeight: "800" }} numberOfLines={1}>
              {rateText(s.rate)}
            </AppText>
          )}
        </Pressable>
        {t.mode === "video" && engine.canPip() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="浮動小視窗" onPress={() => engine.togglePip()} style={styles.btn}>
            <Ionicons name="albums-outline" size={20} color={engine.isPip() ? c.accentText : c.text} />
            <AppText variant="caption" tone="muted" style={styles.pipLabel} numberOfLines={1}>
              小視窗
            </AppText>
          </Pressable>
        ) : null}
        {t.mode !== "audio" && engine.canFullscreen() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="全螢幕" onPress={() => engine.toggleFullscreen()} style={styles.btn}>
            <Ionicons name="expand" size={22} color={c.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderBottomWidth: 1, alignItems: "center" },
  box: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, minHeight: minTouch, width: "100%", maxWidth: maxContentWidth },
  btn: { width: minTouch, height: minTouch, alignItems: "center", justifyContent: "center" },
  bar: { flex: 1 },
  pipLabel: { fontSize: 10, lineHeight: 12 },
  time: { minWidth: 44, textAlign: "right" },
});
