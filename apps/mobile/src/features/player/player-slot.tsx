import { VideoView } from "expo-video";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from "react-native";
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
  const set = (n: Zoom) => {
    zoom.current = n;
    setZ(n);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2 || zoom.current.s > 1,
      onPanResponderGrant: (e) => {
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
      onPanResponderRelease: () => (pinch.current = null),
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
            <VideoView ref={view} player={p} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsPictureInPicture />
          </View>
        ) : null}
      </View>
    </StageFrame>
  );
}
