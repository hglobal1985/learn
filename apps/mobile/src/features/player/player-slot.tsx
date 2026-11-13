import { VideoView } from "expo-video";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { StyleSheet } from "react-native";
import { StageFrame } from "@/ui/stage-frame";
import { engine } from "./engine";
import { usePlayer } from "./use-player";

/** 課程頁的影片區塊（手機 App）：顯示全站同一個播放器的畫面；離開頁面後播放器由浮動小視窗接手。 */
export function PlayerSlot({ trackKey }: { trackKey: string }) {
  const s = usePlayer();
  const view = useRef<VideoView>(null);
  useFocusEffect(
    useCallback(() => {
      engine.setSlot(trackKey);
      engine.setFullscreenTarget(view.current);
      return () => (engine.clearSlot(trackKey), engine.setFullscreenTarget(null));
    }, [trackKey]),
  );
  const p = s.track?.key === trackKey ? engine.player() : null;
  return <StageFrame>{p ? <VideoView ref={view} player={p} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsPictureInPicture /> : null}</StageFrame>;
}
