import { VideoView } from "expo-video";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { engine } from "./engine";
import { usePlayer } from "./use-player";

/** 課程頁的影片區塊（手機 App）：顯示全站同一個播放器的畫面；離開頁面後播放器由浮動小視窗接手。 */
export function PlayerSlot({ trackKey }: { trackKey: string }) {
  const s = usePlayer();
  useFocusEffect(
    useCallback(() => {
      engine.setSlot(trackKey);
      return () => engine.clearSlot(trackKey);
    }, [trackKey]),
  );
  const p = s.track?.key === trackKey ? engine.player() : null;
  return <View style={styles.frame}>{p ? <VideoView player={p} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} allowsPictureInPicture /> : null}</View>;
}

const styles = StyleSheet.create({ frame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" } });
