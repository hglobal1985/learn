import type { Playback } from "@/api/client";
import { resolveUrl } from "@/api/client";
import { Pill } from "@/ui";
import { MediaPlayer } from "./media-player";
import { YouTubePlayer } from "./youtube-player";

/** 依播放來源選擇播放器：示範短片／Mux（HLS）／R2 音檔／YouTube；全部支援時間軸區間。 */
export function LessonPlayer({ playback, onSegmentEnd }: { playback: Playback; onSegmentEnd?: () => void }) {
  const seg = { start: playback.start, end: playback.end };
  if (playback.kind === "youtube") return <YouTubePlayer key={`${playback.videoId}:${seg.start}`} videoId={playback.videoId} {...seg} />;
  if (playback.kind === "hls") return <MediaPlayer key={playback.url} url={playback.url} {...seg} onSegmentEnd={onSegmentEnd} />;
  if (playback.kind === "audio") return <MediaPlayer key={playback.url} url={resolveUrl(playback.url)} audio {...seg} onSegmentEnd={onSegmentEnd} />;
  return (
    <>
      <MediaPlayer key={playback.url} url={resolveUrl(playback.url)} {...seg} onSegmentEnd={onSegmentEnd} />
      <Pill label={playback.label} tone="warning" />
    </>
  );
}
