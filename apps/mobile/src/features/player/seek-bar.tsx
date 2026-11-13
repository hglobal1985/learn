import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";

/**
 * 時間軸細條：點一下跳到該位置，手指按住左右拖曳可連續調整（觸控區高 44px，單手好操作）。
 * value、max 單位相同（秒）；放開手指才真正跳轉。
 */
export function SeekBar({ value, max, onSeek, onTouch }: { value: number; max: number; onSeek: (v: number) => void; onTouch?: () => void }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const geo = useRef({ left: 0, width: 1, max: 1 });
  geo.current.width = width;
  geo.current.max = max;
  const frac = (pageX: number) => Math.min(1, Math.max(0, (pageX - geo.current.left) / geo.current.width));
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        onTouchRef.current?.();
        geo.current.left = e.nativeEvent.pageX - e.nativeEvent.locationX;
        setDrag(frac(e.nativeEvent.pageX) * geo.current.max);
      },
      onPanResponderMove: (e) => setDrag(frac(e.nativeEvent.pageX) * geo.current.max),
      onPanResponderRelease: (e) => {
        onSeekRef.current(frac(e.nativeEvent.pageX) * geo.current.max);
        setDrag(null);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;
  const onTouchRef = useRef(onTouch);
  onTouchRef.current = onTouch;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const shown = drag ?? value;
  const pct = max > 0 ? Math.min(1, Math.max(0, shown / max)) : 0;
  return (
    <View style={styles.touch} onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))} accessibilityRole="adjustable" accessibilityLabel="播放進度" {...responder.panHandlers}>
      <View style={[styles.track, { backgroundColor: c.border }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: c.accent }]} />
      </View>
      <View style={[styles.thumb, { left: `${pct * 100}%`, backgroundColor: c.accent, borderColor: c.surface }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { height: 44, justifyContent: "center", marginHorizontal: 9 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  thumb: { position: "absolute", width: 18, height: 18, borderRadius: 9, marginLeft: -9, borderWidth: 2 },
});
