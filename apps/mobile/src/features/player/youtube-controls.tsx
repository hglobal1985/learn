import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, space } from "@/theme/tokens";
import { AppText } from "@/ui";
import { engine } from "./engine";
import { formatClock, segmentOf } from "./engine.types";
import { SeekBar } from "./seek-bar";
import { usePlayer } from "./use-player";

/**
 * YouTube 的自家精簡控制列（官方控制列已關閉，畫面更乾淨）：播放／暫停、可拖曳的時間軸、時間、全螢幕。
 * 只在課程頁內嵌時顯示；離開課程頁後的浮動小視窗只留播放／暫停與關閉。
 */
export function YouTubeControls() {
  const { c } = useTheme();
  const s = usePlayer();
  const t = s.track;
  if (!t || t.mode !== "youtube") return null;
  const { start, end } = segmentOf(t);
  const total = Math.max(0, (end ?? s.duration) - start);
  const at = Math.min(total, Math.max(0, s.position - start));
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={s.playing ? "暫停" : "播放"} onPress={() => engine.toggle()} style={styles.btn}>
        <Ionicons name={s.playing ? "pause" : "play"} size={24} color={c.text} />
      </Pressable>
      <View style={styles.bar}>
        <SeekBar value={at} max={total || 1} onSeek={(v) => engine.seek(start + v)} />
      </View>
      <AppText variant="caption" tone="muted" style={styles.time}>
        {formatClock(at)}
        {total ? ` / ${formatClock(total)}` : ""}
      </AppText>
      {engine.canFullscreen() ? (
        <Pressable accessibilityRole="button" accessibilityLabel="全螢幕" onPress={() => engine.toggleFullscreen()} style={styles.btn}>
          <Ionicons name="expand" size={22} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, borderBottomWidth: 1, minHeight: minTouch },
  btn: { width: minTouch, height: minTouch, alignItems: "center", justifyContent: "center" },
  bar: { flex: 1 },
  time: { minWidth: 70, textAlign: "right" },
});
