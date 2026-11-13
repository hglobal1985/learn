import { createVideoPlayer, type VideoPlayer, type VideoView } from "expo-video";
import { resolveUrl } from "@/api/client";
import { EMPTY, segmentOf, type Snapshot, type Track } from "./engine.types";
import { askSwitch } from "./switch-prompt";

/**
 * iOS／Android 全站單一播放器：只建立一個 expo-video 播放器，離開課程頁不會銷毀；
 * 課程頁與迷你播放視窗都顯示「同一個」播放器的畫面，所以時間軸與聲音一定同步。
 * 開啟 showNowPlayingNotification／staysActiveInBackground：通知欄與鎖定畫面的播放控制連動。
 * 注意：YouTube 在手機 App 內仍只在課程頁內嵌播放（WebView 無法跨頁保留），不經過這裡。
 */
let snap: Snapshot = EMPTY;
let switchAt = 0;
const listeners = new Set<() => void>();
const emit = (patch: Partial<Snapshot>) => {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
};

let player: VideoPlayer | null = null;
let fsView: VideoView | null = null;
let endedFlag = false;
let subs: { remove(): void }[] = [];

const sourceOf = (t: Track) => {
  const url = t.playback.kind === "youtube" ? "" : t.playback.kind === "hls" ? t.playback.url : resolveUrl(t.playback.url);
  return { uri: url, metadata: { title: t.title, artist: t.subtitle, ...(t.artwork ? { artwork: resolveUrl(t.artwork) } : {}) } };
};

function bind(p: VideoPlayer) {
  subs.forEach((s) => s.remove());
  p.timeUpdateEventInterval = 0.5;
  p.showNowPlayingNotification = true;
  p.staysActiveInBackground = true;
  subs = [
    p.addListener("playingChange", ({ isPlaying }) => emit({ playing: isPlaying })),
    p.addListener("statusChange", ({ status }) => {
      const t = snap.track;
      if (status === "readyToPlay" && t) {
        const { start } = segmentOf(t);
        if (start && p.currentTime < start - 1) p.currentTime = start;
        emit({ loading: false, duration: p.duration });
      } else if (status === "loading") emit({ loading: true });
      else if (status === "error") emit({ loading: false, error: "影片載入失敗，請稍後再試" });
    }),
    p.addListener("timeUpdate", ({ currentTime }) => {
      const t = snap.track;
      if (!t) return;
      const { end } = segmentOf(t);
      if (end != null && currentTime >= end && !endedFlag) {
        endedFlag = true;
        p.pause();
        emit({ position: end, segmentEnded: true });
      } else {
        if (end != null && currentTime < end - 1) endedFlag = false;
        emit({ position: currentTime, ...(endedFlag ? {} : { segmentEnded: false }) });
      }
    }),
    p.addListener("playToEnd", () => {
      endedFlag = true;
      emit({ segmentEnded: true });
    }),
  ];
}

export const engine = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  getSnapshot: () => snap,
  /** 給 VideoView 用的播放器（尚未載入時為 null）。 */
  player: () => player,
  setSlot(key: string | null, _node?: unknown) {
    if (snap.slotKey !== key) emit({ slotKey: key });
  },
  setFullscreenTarget(view: VideoView | null) {
    fsView = view;
  },
  canFullscreen: () => !!fsView,
  toggleFullscreen() {
    void fsView?.enterFullscreen();
  },
  setCollapsed(collapsed: boolean) {
    switchAt = Date.now();
    if (snap.collapsed !== collapsed) emit({ collapsed });
  },
  /** 剛縮小／放大完的 0.5 秒內：手指放開產生的「點擊」會落在換出來的新按鈕上，要忽略，免得誤按播放／暫停或關閉。 */
  recentlySwitched: () => Date.now() - switchAt < 500,
  clearSlot(key: string) {
    if (snap.slotKey === key) emit({ slotKey: null });
  },
  async request(t: Track): Promise<boolean> {
    if (snap.track?.key === t.key) return true;
    if (snap.track && snap.playing && !(await askSwitch(snap.track, t))) return false;
    engine.load(t);
    return true;
  },
  load(t: Track) {
    endedFlag = false;
    const src = sourceOf(t);
    if (!player) {
      player = createVideoPlayer(src);
      bind(player);
    } else player.replace(src);
    emit({ track: t, playing: false, position: segmentOf(t).start, duration: 0, loading: true, error: null, segmentEnded: false, collapsed: false, artworkUrl: t.artwork });
    const { start } = segmentOf(t);
    if (start) player.currentTime = start;
    player.play();
  },
  play: () => player?.play(),
  pause: () => player?.pause(),
  toggle() {
    if (!player) return;
    if (snap.playing) player.pause();
    else {
      if (snap.segmentEnded && snap.track) engine.seek(segmentOf(snap.track).start);
      player.play();
    }
  },
  seek(sec: number) {
    const t = snap.track;
    if (!t || !player) return;
    const { start, end } = segmentOf(t);
    const to = Math.min(end ?? (snap.duration || sec), Math.max(start, sec));
    endedFlag = false;
    emit({ position: to, segmentEnded: false });
    player.currentTime = to;
  },
  skip(delta: number) {
    engine.seek(snap.position + delta);
  },
  close() {
    player?.pause();
    endedFlag = false;
    emit({ ...EMPTY, slotKey: snap.slotKey });
  },
};
