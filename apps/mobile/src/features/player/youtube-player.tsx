import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { radius } from "@/theme/tokens";

/** YouTube 內嵌播放（iOS/Android：WebView）。Web 版見 youtube-player.web.tsx。 */
export function YouTubePlayer({ videoId, start, end }: { videoId: string; start?: number | null; end?: number | null }) {
  const range = `${start ? `&start=${start}` : ""}${end ? `&end=${end}` : ""}`;
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1${range}`;
  return (
    <View style={styles.frame}>
      <WebView
        source={{ uri: src, headers: { Referer: "https://learn.hglobal1985.com/" } }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["https://www.youtube-nocookie.com", "https://www.youtube.com"]}
        setSupportMultipleWindows={false}
        style={{ backgroundColor: "#000" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ frame: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" } });
