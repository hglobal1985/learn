import { createElement } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@/theme/tokens";

/** YouTube 內嵌播放（Web：iframe，使用不追蹤 Cookie 的網域）。 */
export function YouTubePlayer({ videoId }: { videoId: string }) {
  return (
    <View style={styles.frame}>
      {createElement("iframe", {
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`,
        title: "課程影片",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
        allowFullScreen: true,
        referrerPolicy: "strict-origin-when-cross-origin",
        style: { width: "100%", height: "100%", border: 0 },
      })}
    </View>
  );
}

const styles = StyleSheet.create({ frame: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" } });
