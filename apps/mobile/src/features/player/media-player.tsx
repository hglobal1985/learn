import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@/theme/tokens";

export type MediaPlayerProps = {
  url: string;
  audio?: boolean;
  /** 時間軸區間（秒）：從 start 開始，播到 end 自動停止。 */
  start?: number | null;
  end?: number | null;
  onSegmentEnd?: () => void;
};

/** iOS/Android：expo-video 原生播放（HLS、MP4、音檔皆可）。Web 版見 media-player.web.tsx。 */
export function MediaPlayer({ url, audio, start, end, onSegmentEnd }: MediaPlayerProps) {
  const ended = useRef(false);
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.5;
    if (start) p.currentTime = start;
    p.play(); // 點章節進來就自動播放
  });
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "readyToPlay" && start && player.currentTime < start - 1) player.currentTime = start;
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (end != null && currentTime >= end && !ended.current) {
      ended.current = true;
      player.pause();
      onSegmentEnd?.();
    } else if (end != null && currentTime < end - 1) ended.current = false;
  });
  useEventListener(player, "playToEnd", () => onSegmentEnd?.());
  return (
    <View style={[styles.frame, audio ? styles.audio : styles.video]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" fullscreenOptions={{ enable: !audio }} allowsPictureInPicture={!audio} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" },
  video: { aspectRatio: 16 / 9 },
  audio: { height: 96 },
});
