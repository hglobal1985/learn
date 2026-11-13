import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/state/session";
import { engine } from "./engine";
import { usePlayer } from "./use-player";

const MARGIN = 8;
const BAR = 64; // 底部分頁列大約高度

/**
 * 手機 App 的浮動小視窗：離開課程頁後，影片縮成可任意拖曳的小視窗（與課程頁共用同一個播放器，進度同步）。
 * 點一下回到課程頁；有播放／暫停與關閉。純音檔由底部迷你列控制，不顯示視窗。
 */
export function PlayerLayer() {
  const s = usePlayer();
  const { ready, member } = useSession();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const w = Math.round(Math.min(240, Math.max(180, W * 0.55)));
  const h = Math.round((w * 9) / 16);
  const home = { x: W - w - 12, y: H - insets.bottom - BAR - h - 12 };
  const pan = useRef(new Animated.ValueXY(home)).current;
  const cur = useRef(home);
  const t = s.track;
  const show = !!t && t.mode === "video" && s.slotKey !== t.key;

  useEffect(() => {
    if (ready && !member) engine.close();
  }, [ready, member]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => pan.setValue({ x: cur.current.x + g.dx, y: cur.current.y + g.dy }),
      onPanResponderRelease: (_e, g) => {
        if (Math.hypot(g.dx, g.dy) < 6) {
          const tr = engine.getSnapshot().track;
          if (tr) router.push(`/learn/${tr.courseId}/${tr.lessonId}`);
          return;
        }
        const x = Math.min(W - w - MARGIN, Math.max(MARGIN, cur.current.x + g.dx));
        const y = Math.min(H - h - MARGIN, Math.max(MARGIN, cur.current.y + g.dy));
        cur.current = { x, y };
        Animated.spring(pan, { toValue: { x, y }, useNativeDriver: false }).start();
      },
    }),
  ).current;

  const p = show ? engine.player() : null;
  if (!show || !p) return null;
  return (
    <Animated.View style={[styles.win, { width: w, height: h, left: 0, top: 0, transform: pan.getTranslateTransform() }]} {...responder.panHandlers}>
      <VideoView player={p} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsPictureInPicture />
      <Pressable accessibilityLabel="關閉播放" onPress={() => engine.close()} style={[styles.btn, { top: 4, right: 4 }]} hitSlop={8}>
        <Ionicons name="close" size={20} color="#fff" />
      </Pressable>
      <View style={styles.center} pointerEvents="box-none">
        <Pressable accessibilityLabel={s.playing ? "暫停" : "播放"} onPress={() => engine.toggle()} style={[styles.btn, { width: 52, height: 52 }]}>
          <Ionicons name={s.playing ? "pause" : "play"} size={26} color="#fff" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  win: { position: "absolute", borderRadius: 12, overflow: "hidden", backgroundColor: "#000", zIndex: 1000, elevation: 12 },
  center: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  btn: { position: "absolute", width: 40, height: 40, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
