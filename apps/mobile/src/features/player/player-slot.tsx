import Ionicons from "@expo/vector-icons/Ionicons";
import { VideoView } from "expo-video";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { radius } from "@/theme/tokens";
import { AppText } from "@/ui";
import { StageFrame } from "@/ui/stage-frame";
import { engine } from "./engine";
import { usePlayer } from "./use-player";
import { IDENTITY, clampZoom, zoomAt, type Zoom } from "./zoom-math";

/** 兩指之間的距離與中心點。 */
function touchesOf(e: GestureResponderEvent) {
  const t = e.nativeEvent.touches;
  if (t.length < 2) return null;
  const a = t[0]!;
  const b = t[1]!;
  return { dist: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY), mx: (a.locationX + b.locationX) / 2, my: (a.locationY + b.locationY) / 2 };
}

/**
 * 課程頁的影片區塊（手機 App）：顯示全站同一個播放器的畫面；離開頁面後播放器由浮動小視窗接手。
 * 雙指放大縮小（不低於 100%），放大後單指拖曳查看其他區域。
 */
export function PlayerSlot({ trackKey }: { trackKey: string }) {
  const s = usePlayer();
  const view = useRef<VideoView>(null);
  const [z, setZ] = useState<Zoom>(IDENTITY);
  const zoom = useRef<Zoom>(IDENTITY);
  const size = useRef({ w: 1, h: 1 });
  const pinch = useRef<{ dist: number } | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const [showHint, setShowHint] = useState(false);
  // 操作提示：進入影片、觸摸影片、拖曳時間軸時顯示，3.5 秒沒操作就消失。
  useEffect(() => {
    if (!s.hintAt) return;
    setShowHint(true);
    const id = setTimeout(() => setShowHint(false), 3500);
    return () => clearTimeout(id);
  }, [s.hintAt]);
  const set = (n: Zoom) => {
    zoom.current = n;
    setZ(n);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2 || zoom.current.s > 1,
      onPanResponderGrant: (e) => {
        engine.pokeHint();
        pinch.current = null;
        last.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      },
      onPanResponderMove: (e) => {
        const t = touchesOf(e);
        const { w, h } = size.current;
        if (t) {
          if (pinch.current) set(zoomAt(zoom.current, zoom.current.s * (t.dist / pinch.current.dist), t.mx, t.my, w, h));
          pinch.current = { dist: t.dist };
        } else {
          pinch.current = null;
          const dx = e.nativeEvent.pageX - last.current.x;
          const dy = e.nativeEvent.pageY - last.current.y;
          if (zoom.current.s > 1) set(clampZoom({ ...zoom.current, x: zoom.current.x + dx, y: zoom.current.y + dy }, w, h));
        }
        last.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      },
      onPanResponderRelease: (_e, g) => {
        pinch.current = null;
        // 影片任意處點兩下：還原 100% 原始比例。
        if (Math.hypot(g.dx, g.dy) < 8) {
          const now = Date.now();
          if (now - lastTap.current < 320) {
            set(IDENTITY);
            lastTap.current = 0;
          } else lastTap.current = now;
        }
      },
      onPanResponderTerminate: () => (pinch.current = null),
    }),
  ).current;
  useFocusEffect(
    useCallback(() => {
      engine.setSlot(trackKey);
      engine.setFullscreenTarget(view.current);
      return () => (engine.clearSlot(trackKey), engine.setFullscreenTarget(null), set(IDENTITY));
    }, [trackKey]),
  );
  const p = s.track?.key === trackKey ? engine.player() : null;
  return (
    <StageFrame>
      <View style={StyleSheet.absoluteFill} onLayout={(e) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...pan.panHandlers}>
        {p ? (
          <View style={[StyleSheet.absoluteFill, { transformOrigin: "0% 0%", transform: [{ translateX: z.x }, { translateY: z.y }, { scale: z.s }] }]}>
            <VideoView ref={view} player={p} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsPictureInPicture startsPictureInPictureAutomatically />
          </View>
        ) : null}
      </View>
      {showHint ? (
        <View style={styles.hint} pointerEvents="none">
          <Ionicons name="move" size={14} color="#fff" />
          <AppText variant="caption" style={{ color: "#fff" }}>
            可拖曳或放大縮小 點兩下復原
          </AppText>
        </View>
      ) : null}
    </StageFrame>
  );
}

const styles = StyleSheet.create({ hint: { position: "absolute", bottom: 8, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.55)" } });
