import { createElement, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "@/theme/tokens";
import { NoticeBox } from "@/ui";
import type { MediaPlayerProps } from "./media-player";

/**
 * Web 播放器：<video>/<audio>。HLS（Mux）一律用 hls.js 播放，不支援時才用瀏覽器原生 HLS。
 * 支援時間軸區間：載入後跳到 start，播到 end 自動暫停。
 */
export function MediaPlayer({ url, audio, start, end, onSegmentEnd }: MediaPlayerProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setError(null);
    let hls: { destroy(): void } | null = null;
    let cancelled = false;
    const seekToStart = () => {
      if (start && el.currentTime < start - 1) el.currentTime = start;
    };
    el.addEventListener("loadedmetadata", seekToStart);
    const isHls = /\.m3u8(\?|$)/.test(url);
    if (isHls) {
      // 一律優先用 hls.js（行為一致、可回報錯誤）；不支援時才交給瀏覽器原生 HLS（舊版 iPhone Safari）。
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          if (el.canPlayType("application/vnd.apple.mpegurl")) el.src = url;
          else setError("這個瀏覽器無法播放影片，請改用最新版 Chrome、Safari 或 Edge");
          return;
        }
        const h = new Hls({ startPosition: start ?? -1 });
        h.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) setError(data.response?.code === 403 ? "影片授權失敗，請重新整理頁面" : "影片載入失敗，請重新整理頁面或稍後再試");
        });
        h.loadSource(url);
        h.attachMedia(el);
        hls = h;
      });
    } else {
      el.src = url;
    }
    const onError = () => setError("影片載入失敗，請重新整理頁面或稍後再試");
    el.addEventListener("error", onError);
    return () => {
      cancelled = true;
      el.removeEventListener("loadedmetadata", seekToStart);
      el.removeEventListener("error", onError);
      hls?.destroy();
      el.removeAttribute("src");
      el.load();
    };
  }, [url, start]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ended = false;
    const onTime = () => {
      if (end != null && el.currentTime >= end && !ended) {
        ended = true;
        el.pause();
        onSegmentEnd?.();
      } else if (end != null && el.currentTime < end - 1) ended = false;
    };
    const onEnded = () => onSegmentEnd?.();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [end, onSegmentEnd]);

  return (
    <>
      <View style={[styles.frame, audio ? styles.audio : styles.video]}>
        {createElement(audio ? "audio" : "video", {
          ref,
          controls: true,
          playsInline: true,
          preload: "metadata",
          controlsList: "nodownload",
          style: audio ? { width: "100%", height: "100%" } : { width: "100%", height: "100%", background: "#000" },
        })}
      </View>
      {error ? <NoticeBox tone="danger" text={error} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: radius.md, overflow: "hidden" },
  video: { aspectRatio: 16 / 9, backgroundColor: "#000" },
  audio: { height: 64, justifyContent: "center" },
});
