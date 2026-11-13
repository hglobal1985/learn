import type { Playback } from "@/api/client";

export type TrackMode = "audio" | "video" | "youtube";

/** 一個「正在播放或準備播放」的章節。key 相同＝同一堂，回到課程頁不會重新載入。 */
export type Track = {
  key: string;
  courseId: string;
  lessonId: string;
  title: string;
  subtitle: string;
  mode: TrackMode;
  playback: Playback;
  /** 通知欄播放器的圖片：課程 EDM（沒有就用封面）。純音檔另外優先用音檔內嵌的專輯封面。 */
  artwork: string | null;
};

export type Snapshot = {
  track: Track | null;
  playing: boolean;
  /** 目前播放位置（秒，影片本身的時間）。 */
  position: number;
  duration: number;
  loading: boolean;
  error: string | null;
  /** 這一段（時間軸區間或整支）播放完畢。 */
  segmentEnded: boolean;
  /** 目前顯示在課程頁上的播放區塊屬於哪一個 track（沒有＝已離開課程頁，進入迷你播放器模式）。 */
  slotKey: string | null;
  /** 迷你播放器縮成小圓圖（播放中會旋轉）。換播另一堂時會恢復。 */
  collapsed: boolean;
  /** 目前顯示的圖片（課程 EDM；純音檔有內嵌專輯封面時用封面）。 */
  artworkUrl: string | null;
};

export const EMPTY: Snapshot = { track: null, playing: false, position: 0, duration: 0, loading: false, error: null, segmentEnded: false, slotKey: null, collapsed: false, artworkUrl: null };

export const trackMode = (p: Playback): TrackMode => (p.kind === "youtube" ? "youtube" : p.kind === "audio" ? "audio" : "video");

export function buildTrack(p: Playback, meta: { courseId: string; lessonId: string; title: string; subtitle: string; artwork: string | null }): Track {
  return { key: `${meta.courseId}:${meta.lessonId}`, ...meta, mode: trackMode(p), playback: p };
}

/** 這一堂的時間軸區間（秒）。 */
export const segmentOf = (t: Track): { start: number; end: number | null } => ({ start: t.playback.start ?? 0, end: t.playback.end ?? null });

/** 秒數 → m:ss 或 h:mm:ss */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

