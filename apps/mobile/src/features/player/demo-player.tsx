import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";
import { radius } from "@/theme/tokens";

/** 示範播放器（expo-video：iOS/Android 原生播放、Web 為 HTML video）。正式影片串接 Mux/YouTube 時替換來源即可。 */
export function DemoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <View style={styles.frame}>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} allowsPictureInPicture />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" },
  video: { width: "100%", height: "100%" },
});
