import type { Playback } from "@/api/client";
import { resolveUrl } from "@/api/client";
import { Pill } from "@/ui";
import { DemoPlayer } from "./demo-player";
import { YouTubePlayer } from "./youtube-player";

/** 依播放來源選擇播放器：示範短片／Mux（HLS，expo-video）／YouTube。 */
export function LessonPlayer({ playback }: { playback: Playback }) {
  if (playback.kind === "youtube") return <YouTubePlayer key={playback.videoId} videoId={playback.videoId} />;
  if (playback.kind === "hls") return <DemoPlayer key={playback.url} url={playback.url} />;
  return (
    <>
      <DemoPlayer key={playback.url} url={resolveUrl(playback.url)} />
      <Pill label={playback.label} tone="warning" />
    </>
  );
}
