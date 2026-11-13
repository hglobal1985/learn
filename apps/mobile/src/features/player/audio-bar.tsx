import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText } from "@/ui";
import { engine } from "./engine";
import { formatClock, segmentOf } from "./engine.types";
import { SeekBar } from "./seek-bar";
import { usePlayer } from "./use-player";

const back = (courseId: string, lessonId: string) => router.push(`/learn/${courseId}/${lessonId}`);

/**
 * 音檔播放控制：課程頁內嵌（完整版）與離開課程頁後的底部迷你列（compact）共用。
 * 時間軸細條可拖曳調整進度；迷你列點標題區回到課程頁。
 */
export function AudioBar({ compact }: { compact?: boolean }) {
  const { c } = useTheme();
  const s = usePlayer();
  const t = s.track;
  if (!t) return null;
  const { start, end } = segmentOf(t);
  const total = Math.max(0, (end ?? s.duration) - start);
  const at = Math.min(total, Math.max(0, s.position - start));
  const seek = (v: number) => engine.seek(start + v);
  const icon = s.loading && !s.playing ? "hourglass-outline" : s.playing ? "pause" : "play";
  return (
    <View style={[styles.box, compact ? styles.compact : [styles.full, { backgroundColor: c.surface, borderColor: c.border }]]}>
      {compact ? <SeekBar value={at} max={total || 1} onSeek={seek} /> : null}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={s.playing ? "暫停" : "播放"} onPress={() => engine.toggle()} style={[styles.play, { backgroundColor: c.accent }]}>
          <Ionicons name={icon} size={26} color={c.textOnAccent} />
        </Pressable>
        <Pressable style={styles.info} disabled={!compact} onPress={() => back(t.courseId, t.lessonId)} accessibilityLabel="回到課程頁">
          <AppText variant="callout" numberOfLines={1} style={{ fontWeight: "600" }}>
            {t.title}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {formatClock(at)} / {formatClock(total)}
            {compact ? ` · ${t.subtitle}` : ""}
          </AppText>
        </Pressable>
        {!compact ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="倒退 10 秒" onPress={() => engine.skip(-10)} style={styles.small}>
              <Ionicons name="play-back" size={22} color={c.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="快轉 10 秒" onPress={() => engine.skip(10)} style={styles.small}>
              <Ionicons name="play-forward" size={22} color={c.text} />
            </Pressable>
          </>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="關閉播放" onPress={() => engine.close()} style={styles.small}>
            <Ionicons name="close" size={24} color={c.textMuted} />
          </Pressable>
        )}
      </View>
      {!compact ? <SeekBar value={at} max={total || 1} onSeek={seek} /> : null}
    </View>
  );
}

/** 課程頁的音檔區：登記「播放區塊」在這一頁，離開頁面後才會切換成底部迷你列。 */
export function InlineAudio({ trackKey }: { trackKey: string }) {
  useFocusEffect(
    useCallback(() => {
      engine.setSlot(trackKey);
      return () => engine.clearSlot(trackKey);
    }, [trackKey]),
  );
  return <AudioBar />;
}

/** 離開課程頁後，音檔以底部細條呈現（在底部分頁列正上方）。 */
export function MiniAudioBar() {
  const { c } = useTheme();
  const s = usePlayer();
  if (!s.track || s.track.mode !== "audio" || s.slotKey === s.track.key) return null;
  return (
    <View style={[styles.mini, { backgroundColor: c.surface, borderTopColor: c.border }]}>
      <AudioBar compact />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.xs },
  full: { borderRadius: radius.md, borderWidth: 1, padding: space.md },
  compact: { paddingHorizontal: space.sm, paddingBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  play: { width: minTouch, height: minTouch, borderRadius: minTouch / 2, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, minHeight: minTouch, justifyContent: "center" },
  small: { width: minTouch - 4, height: minTouch, alignItems: "center", justifyContent: "center" },
  mini: { borderTopWidth: 1 },
});
