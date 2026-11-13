import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveUrl } from "@/api/client";
import { useSession } from "@/state/session";
import { engine } from "./engine";
import { usePlayer } from "./use-player";

const MARGIN = 8;
const BAR = 64; // 底部分頁列大約高度
const CIRCLE = 84;
const GOLD = "#f2c063"; // 網站色系的金色外框（原生版沒有漸層元件，用金色框加綠色光暈近似網頁版的反光外框）
const GREEN = "#0c603c";

/**
 * 手機 App 的浮動小視窗：離開課程頁後，影片縮成可任意拖曳的小視窗（與課程頁共用同一個播放器，進度同步）。
 * 點一下回到課程頁；有播放／暫停、縮小與關閉。按「縮小」變成小圓圖（課程 EDM，播放中 360 度旋轉），點一下恢復。
 * 純音檔平常由底部迷你列控制，按「縮小」後也會變成同樣的小圓圖。
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
  const spin = useRef(new Animated.Value(0)).current;
  const t = s.track;
  const away = !!t && s.slotKey !== t.key;
  const circle = away && s.collapsed;
  const windowed = away && !s.collapsed && t.mode === "video";
  const size = useRef({ w, h });
  size.current = circle ? { w: CIRCLE, h: CIRCLE } : { w, h };

  useEffect(() => {
    if (ready && !member) engine.close();
  }, [ready, member]);

  // 小圓圖：播放中持續旋轉，暫停就停住。
  useEffect(() => {
    if (!circle || !s.playing) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true }));
    spin.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [circle, s.playing, spin]);

  const place = (x: number, y: number, animate = true) => {
    const nx = Math.min(W - size.current.w - MARGIN, Math.max(MARGIN, x));
    const ny = Math.min(H - size.current.h - MARGIN, Math.max(MARGIN, y));
    cur.current = { x: nx, y: ny };
    if (animate) Animated.spring(pan, { toValue: { x: nx, y: ny }, useNativeDriver: false }).start();
    else pan.setValue({ x: nx, y: ny });
  };
  /** 縮小／恢復時，讓小圓圖貼著小視窗的右上角。 */
  const resize = (toCircle: boolean) => {
    if (t?.mode === "audio") return engine.setCollapsed(toCircle);
    const right = cur.current.x + (toCircle ? w : CIRCLE);
    size.current = toCircle ? { w: CIRCLE, h: CIRCLE } : { w, h };
    place(right - size.current.w, cur.current.y, false);
    engine.setCollapsed(toCircle);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => pan.setValue({ x: cur.current.x + g.dx, y: cur.current.y + g.dy }),
      onPanResponderRelease: (_e, g) => {
        if (Math.hypot(g.dx, g.dy) < 6) {
          const sn = engine.getSnapshot();
          if (sn.collapsed) resizeRef.current(false);
          else if (sn.track) router.push(`/learn/${sn.track.courseId}/${sn.track.lessonId}`);
          return;
        }
        placeRef.current(cur.current.x + g.dx, cur.current.y + g.dy);
      },
    }),
  ).current;
  const resizeRef = useRef(resize);
  resizeRef.current = resize;
  const placeRef = useRef(place);
  placeRef.current = place;

  const p = windowed ? engine.player() : null;
  if (!circle && !(windowed && p)) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const art = s.artworkUrl ? { uri: resolveUrl(s.artworkUrl) } : require("../../../assets/icon.png");
  if (circle)
    return (
      <Animated.View style={[styles.circle, { transform: pan.getTranslateTransform() }]} {...responder.panHandlers} accessibilityLabel="恢復迷你播放器（可按住拖曳移動）" accessibilityRole="button">
        <Animated.Image source={art} style={[styles.art, s.playing ? { transform: [{ rotate }] } : null]} />
        {!s.playing ? (
          <View style={styles.dim} pointerEvents="none">
            <Ionicons name="play" size={22} color="#fff" />
          </View>
        ) : null}
      </Animated.View>
    );
  return (
    <Animated.View style={[styles.win, { width: w, height: h, transform: pan.getTranslateTransform() }]} {...responder.panHandlers}>
      <VideoView player={p!} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsPictureInPicture startsPictureInPictureAutomatically />
      <Pressable accessibilityLabel="關閉播放" onPress={() => !engine.recentlySwitched() && engine.close()} style={[styles.btn, { top: 4, right: 4 }]} hitSlop={8}>
        <Ionicons name="close" size={20} color="#fff" />
      </Pressable>
      <Pressable accessibilityLabel="縮小成小圓圖" onPress={() => resize(true)} style={[styles.btn, { top: 48, right: 4 }]} hitSlop={8}>
        <Ionicons name="remove" size={22} color="#fff" />
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
  win: { position: "absolute", left: 0, top: 0, borderRadius: 14, overflow: "hidden", backgroundColor: "#000", borderWidth: 4.5, borderColor: GOLD, shadowColor: GREEN, shadowOpacity: 0.5, shadowRadius: 10, zIndex: 1000, elevation: 12 },
  circle: { position: "absolute", left: 0, top: 0, width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, overflow: "hidden", backgroundColor: "#000", borderWidth: 4.5, borderColor: GOLD, shadowColor: GREEN, shadowOpacity: 0.5, shadowRadius: 10, zIndex: 1000, elevation: 12 },
  art: { width: CIRCLE - 9, height: CIRCLE - 9 },
  dim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  center: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  btn: { position: "absolute", width: 40, height: 40, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
