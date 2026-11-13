import { resolveUrl } from "@/api/client";
import { EMPTY, segmentOf, type Snapshot, type Track } from "./engine.types";
import { askSwitch } from "./switch-prompt";

/**
 * Web 全站單一播放器：媒體元素（<video>）只建立一次、永遠不會被搬動或銷毀，
 * 所以離開課程頁後聲音與畫面都持續、回到課程頁時間軸與聲音同步。
 * 畫面位置由 player-layer.web.tsx 依「目前是否在課程頁」決定（課程頁內嵌／右下角浮動小視窗）。
 * 影片（含 Mux HLS）與音檔共用同一個元素；YouTube 用 iframe，靠 postMessage 控制。
 */
let snap: Snapshot = EMPTY;
const listeners = new Set<() => void>();
const emit = (patch: Partial<Snapshot>) => {
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
};

let el: HTMLVideoElement | null = null;
let hls: { destroy(): void } | null = null;
let slotEl: HTMLElement | null = null;
let ytFrame: HTMLIFrameElement | null = null;
let endedFlag = false;
let lastSession = 0;

export function element(): HTMLVideoElement {
  if (el) return el;
  const v = document.createElement("video");
  v.playsInline = true;
  v.preload = "metadata";
  v.setAttribute("controlsList", "nodownload");
  v.style.cssText = "width:100%;height:100%;background:#000;display:block";
  v.addEventListener("play", () => emit({ playing: true }));
  v.addEventListener("pause", () => emit({ playing: false }));
  v.addEventListener("loadedmetadata", () => {
    const t = snap.track;
    if (!t) return;
    const { start } = segmentOf(t);
    if (start && v.currentTime < start - 1) v.currentTime = start;
    emit({ duration: Number.isFinite(v.duration) ? v.duration : 0, loading: false });
  });
  v.addEventListener("waiting", () => emit({ loading: true }));
  v.addEventListener("playing", () => emit({ loading: false }));
  v.addEventListener("timeupdate", () => {
    const t = snap.track;
    if (!t) return;
    const { end } = segmentOf(t);
    if (end != null && v.currentTime >= end && !endedFlag) {
      endedFlag = true;
      v.pause();
      emit({ position: end, segmentEnded: true });
    } else {
      if (end != null && v.currentTime < end - 1) endedFlag = false;
      emit({ position: v.currentTime, ...(endedFlag ? {} : { segmentEnded: false }) });
    }
    updateSessionPosition();
  });
  v.addEventListener("ended", () => {
    endedFlag = true;
    emit({ segmentEnded: true });
  });
  v.addEventListener("error", () => {
    if (snap.track?.mode !== "youtube" && v.getAttribute("src")) emit({ error: "影片載入失敗，請重新整理頁面或稍後再試", loading: false });
  });
  el = v;
  return v;
}

function teardownMedia() {
  hls?.destroy();
  hls = null;
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
}

function loadMedia(t: Track) {
  const v = element();
  const { start } = segmentOf(t);
  const url = t.playback.kind === "youtube" ? "" : t.playback.kind === "hls" ? t.playback.url : resolveUrl(t.playback.url);
  const tryPlay = () => void v.play().catch(() => undefined);
  v.addEventListener("canplay", tryPlay, { once: true });
  if (/\.m3u8(\?|$)/.test(url)) {
    import("hls.js").then(({ default: Hls }) => {
      if (snap.track?.key !== t.key) return;
      if (!Hls.isSupported()) {
        if (v.canPlayType("application/vnd.apple.mpegurl")) v.src = url;
        else emit({ error: "這個瀏覽器無法播放影片，請改用最新版 Chrome、Safari 或 Edge", loading: false });
        return;
      }
      const h = new Hls({ startPosition: start || -1 });
      h.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) emit({ error: data.response?.code === 403 ? "影片授權失敗，請重新整理頁面" : "影片載入失敗，請重新整理頁面或稍後再試", loading: false });
      });
      h.loadSource(url);
      h.attachMedia(v);
      hls = h;
    });
  } else v.src = url;
}

// ---- 通知欄／鎖定畫面（Media Session）----
function setupSession(t: Track) {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({ title: t.title, artist: t.subtitle, album: "寰宇行動大學", artwork: [{ src: `${location.origin}/icon-512.png`, sizes: "512x512", type: "image/png" }] });
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
}
function updateSessionPosition() {
  const now = Date.now();
  if (now - lastSession < 1000 || !el || !("mediaSession" in navigator) || !snap.track) return;
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
   * 另一堂正在播放：詢問是否中斷；選擇「繼續原本的」回傳 false（呼叫端應回到原本那堂）。
   */
  async request(t: Track): Promise<boolean> {
    if (snap.track?.key === t.key) {
      // 同一堂：只更新播放資訊（簽名網址可能更新），不重新載入。
      return true;
    }
    if (snap.track && snap.playing && !(await askSwitch(snap.track, t))) return false;
    engine.load(t);
    return true;
  },
  load(t: Track) {
    teardownMedia();
    endedFlag = false;
    emit({ track: t, playing: false, position: segmentOf(t).start, duration: 0, loading: t.mode !== "youtube", error: null, segmentEnded: false });
    if (t.mode !== "youtube") {
      loadMedia(t);
      setupSession(t);
    } else if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  },
  play() {
    if (snap.track?.mode === "youtube") ytCommand("playVideo");
    else void el?.play().catch(() => undefined);
  },
  pause() {
    if (snap.track?.mode === "youtube") ytCommand("pauseVideo");
    else el?.pause();
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
    else if (el) el.currentTime = to;
  },
  skip(delta: number) {
    engine.seek(snap.position + delta);
  },
  close() {
    teardownMedia();
    endedFlag = false;
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    emit({ ...EMPTY, slotKey: snap.slotKey });
  },
};
