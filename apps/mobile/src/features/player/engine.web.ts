import { resolveUrl } from "@/api/client";
import { embeddedCover } from "./audio-cover";
import { EMPTY, segmentOf, type Snapshot, type Track } from "./engine.types";
import { askSwitch } from "./switch-prompt";

/**
 * Web 全站單一播放器：媒體元素只建立一次、永遠不會被搬動或銷毀，
 * 所以離開課程頁後聲音與畫面都持續、回到課程頁時間軸與聲音同步。
 * 畫面位置由 player-layer.web.tsx 決定（課程頁內嵌／右下角浮動小視窗）。
 *
 * 背景播放：手機瀏覽器（Android Chrome、iOS Safari）在使用者按 Home／切到別的 App／鎖螢幕時，
 * 會暫停有畫面的 <video>，但不會暫停 <audio>。所以離開瀏覽器的當下，把同一支影片的「聲音」
 * 無縫交給一個隱藏的 <audio> 元素接著播（從同一個秒數開始）；回到瀏覽器再把影像接回去。
 */
let snap: Snapshot = EMPTY;
const listeners = new Set<() => void>();
const emit = (patch: Partial<Snapshot>) => {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
};

let video: HTMLVideoElement | null = null;
let audio: HTMLAudioElement | null = null;
let hlsVideo: { destroy(): void } | null = null;
let hlsAudio: { destroy(): void } | null = null;
let slotEl: HTMLElement | null = null;
let ytFrame: HTMLIFrameElement | null = null;
let endedFlag = false;
let lastSession = 0;
/** 使用者想要「播放中」：只有使用者自己按暫停（或播完）才會變 false；瀏覽器因為切到背景而自動暫停不算。 */
let intent = false;
/** 目前由隱藏的 <audio> 在背景接手播放。 */
let bg = false;
let coverUrl: string | null = null;

const active = (): HTMLMediaElement | null => (bg ? audio : video);

function wire(el: HTMLMediaElement) {
  const mine = () => el === active();
  el.addEventListener("play", () => {
    if (!mine()) return;
    intent = true;
    emit({ playing: true });
  });
  el.addEventListener("pause", () => {
    if (!mine()) return;
    // 畫面在前景時的暫停＝使用者暫停；在背景時的暫停＝瀏覽器自動暫停（之後要接回去）。
    if (!document.hidden && !bg) intent = false;
    emit({ playing: false });
  });
  el.addEventListener("loadedmetadata", () => {
    const t = snap.track;
    if (!t || !mine()) return;
    const { start } = segmentOf(t);
    if (start && el.currentTime < start - 1) el.currentTime = start;
    emit({ duration: Number.isFinite(el.duration) ? el.duration : snap.duration, loading: false });
  });
  el.addEventListener("waiting", () => mine() && emit({ loading: true }));
  el.addEventListener("playing", () => mine() && emit({ loading: false }));
  el.addEventListener("timeupdate", () => {
    const t = snap.track;
    if (!t || !mine()) return;
    const { end } = segmentOf(t);
    if (end != null && el.currentTime >= end && !endedFlag) {
      endedFlag = true;
      intent = false;
      el.pause();
      emit({ position: end, segmentEnded: true });
    } else {
      if (end != null && el.currentTime < end - 1) endedFlag = false;
      emit({ position: el.currentTime, ...(endedFlag ? {} : { segmentEnded: false }) });
    }
    updateSessionPosition(el);
  });
  el.addEventListener("ended", () => {
    if (!mine()) return;
    endedFlag = true;
    intent = false;
    emit({ segmentEnded: true });
  });
  el.addEventListener("error", () => {
    if (mine() && snap.track?.mode !== "youtube" && el.getAttribute("src")) emit({ error: "影片載入失敗，請重新整理頁面或稍後再試", loading: false });
  });
}

export function element(): HTMLVideoElement {
  if (video) return video;
  const v = document.createElement("video");
  v.playsInline = true;
  v.preload = "metadata";
  v.setAttribute("controlsList", "nodownload");
  v.style.cssText = "width:100%;height:100%;background:#000;display:block";
  wire(v);
  video = v;
  return v;
}

function audioElement(): HTMLAudioElement {
  if (audio) return audio;
  const a = document.createElement("audio");
  a.preload = "auto";
  a.style.display = "none";
  document.body.appendChild(a);
  wire(a);
  audio = a;
  return a;
}

const urlOf = (t: Track) => (t.playback.kind === "youtube" ? "" : t.playback.kind === "hls" ? t.playback.url : resolveUrl(t.playback.url));

/** 把來源接到某個媒體元素（HLS 用 hls.js），並從 startAt 秒開始。回傳 hls 實例。 */
function attach(el: HTMLMediaElement, t: Track, startAt: number, autoplay: boolean, keep: (h: { destroy(): void } | null) => void) {
  const url = urlOf(t);
  const onReady = () => {
    if (startAt && el.currentTime < startAt - 1) el.currentTime = startAt;
    if (autoplay) void el.play().catch(() => undefined);
  };
  el.addEventListener("canplay", onReady, { once: true });
  if (/\.m3u8(\?|$)/.test(url)) {
    import("hls.js").then(({ default: Hls }) => {
      if (snap.track?.key !== t.key) return;
      if (!Hls.isSupported()) {
        if (el.canPlayType("application/vnd.apple.mpegurl")) el.src = url;
        else emit({ error: "這個瀏覽器無法播放影片，請改用最新版 Chrome、Safari 或 Edge", loading: false });
        return;
      }
      const h = new Hls({ startPosition: startAt || -1 });
      h.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) emit({ error: data.response?.code === 403 ? "影片授權失敗，請重新整理頁面" : "影片載入失敗，請重新整理頁面或稍後再試", loading: false });
      });
      h.loadSource(url);
      h.attachMedia(el);
      keep(h);
    });
  } else el.src = url;
}

function detach(el: HTMLMediaElement | null, which: "video" | "audio") {
  if (which === "video") {
    hlsVideo?.destroy();
    hlsVideo = null;
  } else {
    hlsAudio?.destroy();
    hlsAudio = null;
  }
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
}

function teardownMedia() {
  bg = false;
  detach(video, "video");
  detach(audio, "audio");
  if (coverUrl) URL.revokeObjectURL(coverUrl);
  coverUrl = null;
}

// ---- 背景播放：離開瀏覽器時，聲音交給 <audio>；回來時影像接回去 ----
function toBackground() {
  const t = snap.track;
  if (bg || !t || t.mode !== "video" || !intent || !video) return;
  const pos = video.currentTime;
  const a = audioElement();
  bg = true; // 先切換旗標，之後 video 的暫停事件才不會被當成使用者暫停
  video.pause();
  detach(a, "audio");
  attach(a, t, pos, true, (h) => (hlsAudio = h));
}
function toForeground() {
  if (!bg || !video || !audio) return;
  const pos = audio.currentTime;
  detach(audio, "audio");
  bg = false;
  const want = intent;
  if (Number.isFinite(pos) && pos > 0) video.currentTime = pos;
  emit({ position: pos });
  if (want) void video.play().catch(() => undefined);
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => (document.hidden ? toBackground() : toForeground()));
  // iOS Safari 切換 App 時比較常觸發 pagehide／pageshow
  window.addEventListener("pagehide", toBackground);
  window.addEventListener("pageshow", () => !document.hidden && toForeground());
}

// ---- 通知欄／鎖定畫面（Media Session）----
function artworkList(src: string | null): MediaImage[] {
  const abs = (u: string) => (/^(https?:|blob:|data:)/.test(u) ? u : `${location.origin}${u.startsWith("/") ? "" : "/"}${u}`);
  return [{ src: src ? abs(src) : `${location.origin}/icon-512.png` }];
}
function setupSession(t: Track) {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({ title: t.title, artist: t.subtitle, album: "寰宇行動大學", artwork: artworkList(t.artwork) });
  const set = (a: MediaSessionAction, f: MediaSessionActionHandler | null) => {
    try {
      ms.setActionHandler(a, f);
    } catch {
      /* 這個瀏覽器不支援該動作 */
    }
  };
  set("play", () => engine.play());
  set("pause", () => engine.pause());
  set("seekbackward", (d) => engine.skip(-(d.seekOffset ?? 10)));
  set("seekforward", (d) => engine.skip(d.seekOffset ?? 10));
  set("seekto", (d) => d.seekTime != null && engine.seek(d.seekTime));
  set("stop", () => engine.close());
  // 純音檔：優先使用音檔內嵌的專輯封面（沒有就維持課程 EDM）。
  if (t.mode === "audio") {
    void embeddedCover(urlOf(t)).then((blobUrl) => {
      if (!blobUrl) return;
      if (snap.track?.key !== t.key) return void URL.revokeObjectURL(blobUrl);
      coverUrl = blobUrl;
      ms.metadata = new MediaMetadata({ title: t.title, artist: t.subtitle, album: "寰宇行動大學", artwork: [{ src: blobUrl }] });
    });
  }
}
function updateSessionPosition(el: HTMLMediaElement) {
  const now = Date.now();
  if (now - lastSession < 1000 || !("mediaSession" in navigator) || !snap.track) return;
  lastSession = now;
  const { start, end } = segmentOf(snap.track);
  const total = (end ?? (Number.isFinite(el.duration) ? el.duration : 0)) - start;
  if (total > 0) {
    try {
      navigator.mediaSession.setPositionState({ duration: total, position: Math.min(total, Math.max(0, el.currentTime - start)), playbackRate: el.playbackRate });
    } catch {
      /* 忽略 */
    }
  }
}

// ---- YouTube（iframe + postMessage）----
function ytCommand(func: string, args: unknown[] = []) {
  ytFrame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
}
if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin) || snap.track?.mode !== "youtube") return;
    let d: { event?: string; info?: { playerState?: number; currentTime?: number } | number };
    try {
      d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    const state = d.event === "onStateChange" ? (d.info as number) : d.event === "infoDelivery" && typeof d.info === "object" ? d.info?.playerState : undefined;
    if (state === 1) emit({ playing: true, segmentEnded: false, loading: false });
    else if (state === 2) emit({ playing: false });
    else if (state === 0) emit({ playing: false, segmentEnded: true });
    if (d.event === "infoDelivery" && typeof d.info === "object" && typeof d.info?.currentTime === "number") emit({ position: d.info.currentTime });
  });
}

export const engine = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  getSnapshot: () => snap,
  element,
  /** 課程頁登記「播放區塊」：有登記＝內嵌模式；離開頁面（null）＝迷你播放器模式。 */
  setSlot(key: string | null, node: HTMLElement | null = null) {
    slotEl = node;
    if (snap.slotKey !== key) emit({ slotKey: key });
  },
  clearSlot(key: string) {
    if (snap.slotKey === key) {
      slotEl = null;
      emit({ slotKey: null });
    }
  },
  slotElement: () => slotEl,
  setYoutubeFrame(f: HTMLIFrameElement | null) {
    ytFrame = f;
    if (f) f.addEventListener("load", () => f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*"));
  },
  /**
   * 課程頁要播放這一堂。同一堂：直接接上（不重新載入）。
   * 另一堂正在播放：詢問是否中斷；選擇「關閉」回傳 false（呼叫端應回到原本那堂）。
   */
  async request(t: Track): Promise<boolean> {
    if (snap.track?.key === t.key) return true;
    if (snap.track && snap.playing && !(await askSwitch(snap.track, t))) return false;
    engine.load(t);
    return true;
  },
  load(t: Track) {
    teardownMedia();
    endedFlag = false;
    intent = false; // 等真的開始播放（play 事件）才算「想播放」
    emit({ track: t, playing: false, position: segmentOf(t).start, duration: 0, loading: t.mode !== "youtube", error: null, segmentEnded: false });
    if (t.mode !== "youtube") {
      attach(element(), t, segmentOf(t).start, true, (h) => (hlsVideo = h));
      setupSession(t);
    } else if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  },
  play() {
    intent = true;
    if (snap.track?.mode === "youtube") ytCommand("playVideo");
    else void active()?.play().catch(() => undefined);
  },
  pause() {
    intent = false;
    if (snap.track?.mode === "youtube") ytCommand("pauseVideo");
    else active()?.pause();
  },
  toggle() {
    if (snap.playing) engine.pause();
    else {
      if (snap.segmentEnded && snap.track) engine.seek(segmentOf(snap.track).start);
      engine.play();
    }
  },
  /** 跳到影片本身的某個時間（秒），限制在這一堂的區間內。 */
  seek(sec: number) {
    const t = snap.track;
    if (!t) return;
    const { start, end } = segmentOf(t);
    const max = end ?? (snap.duration || sec);
    const to = Math.min(max, Math.max(start, sec));
    endedFlag = false;
    emit({ position: to, segmentEnded: false });
    if (t.mode === "youtube") ytCommand("seekTo", [to, true]);
    else {
      const el = active();
      if (el) el.currentTime = to;
    }
  },
  skip(delta: number) {
    engine.seek(snap.position + delta);
  },
  close() {
    intent = false;
    teardownMedia();
    endedFlag = false;
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    emit({ ...EMPTY, slotKey: snap.slotKey });
  },
};
