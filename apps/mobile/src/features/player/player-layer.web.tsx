import { router } from "expo-router";
import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useSession } from "@/state/session";
import { engine } from "./engine.web";
import { usePlayer } from "./use-player";

const POS_KEY = "hglobal:learn:mini-pos";
const MARGIN = 8;
const CIRCLE = 84;
/** 外框：網站色系（深綠、橄欖、金）的高級反光漸層，緩慢流動。 */
const FRAME = "linear-gradient(135deg,#0c603c 0%,#cee49f 16%,#fff3c4 28%,#f2c063 40%,#486c48 56%,#0c603c 70%,#cee49f 84%,#0c603c 100%)";

type Pos = { x: number; y: number };
const floatWidth = () => Math.round(Math.min(240, Math.max(180, window.innerWidth * 0.55)));

function bottomEdge() {
  const bar = document.querySelector('[role="tablist"]');
  return bar ? bar.getBoundingClientRect().top : window.innerHeight;
}
const clamp = (p: Pos, w: number, h: number): Pos => ({
  x: Math.min(window.innerWidth - w - MARGIN, Math.max(MARGIN, p.x)),
  y: Math.min(window.innerHeight - h - MARGIN, Math.max(MARGIN, p.y)),
});

const btn: CSSProperties = { position: "absolute", border: 0, borderRadius: 999, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", font: "700 16px sans-serif", padding: 0 };

/**
 * Web 全站播放畫面層（只有一份、永遠存在）：
 * - 在課程頁：疊在頁面上方釘住的影片區塊上（內嵌，用瀏覽器原生控制列）。
 * - 離開課程頁：縮成右下角浮動小視窗，手指按住可任意拖曳位置；點一下回到課程頁；有播放／暫停、縮小與關閉。
 * - 按「縮小」：變成一個小圓圖（課程 EDM，播放中 360 度旋轉），可拖曳，點一下恢復小視窗。
 * - 純音檔平常由底部迷你列控制；按「縮小」後也會變成同樣的小圓圖。
 */
export function PlayerLayer() {
  const s = usePlayer();
  const { ready, member } = useSession();
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pos = useRef<Pos | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const t = s.track;
  const isAudio = t?.mode === "audio";
  const inlineSlot = !!t && s.slotKey === t.key;
  // 影片／YouTube：在課程頁內嵌，其餘時間是浮動小視窗；純音檔只有「縮小」時才有畫面（小圓圖）。
  const inline = !!t && !isAudio && inlineSlot;
  const floating = !!t && !inlineSlot && (!isAudio || s.collapsed);
  const circle = floating && s.collapsed;
  const windowed = floating && !s.collapsed;

  useEffect(() => {
    hostRef.current?.appendChild(engine.element());
    engine.setFullscreenTarget(boxRef.current);
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) pos.current = JSON.parse(raw) as Pos;
    } catch {
      /* 沒有儲存的位置就用預設 */
    }
  }, []);

  // 登出就關閉播放（不留下上一位會員的聲音）。
  useEffect(() => {
    if (ready && !member) engine.close();
  }, [ready, member]);

  // 播放控制列在影片外面（PlayerControls）；只有全螢幕時才用瀏覽器內建的控制列（全螢幕裡看不到外面的控制列）。
  useEffect(() => {
    const el = engine.element();
    const sync = () => {
      el.controls = !!document.fullscreenElement && document.fullscreenElement === boxRef.current;
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // 每個畫面更新時對齊位置：內嵌＝貼齊課程頁的播放區塊；浮動＝使用者拖曳過的位置；縮小＝小圓圖。
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const box = boxRef.current;
      if (!box) return;
      const sn = engine.getSnapshot();
      const tr = sn.track;
      let css = "none";
      if (tr) {
        const slot = sn.slotKey === tr.key ? engine.slotElement() : null;
        if (tr.mode !== "audio" && slot && slot.isConnected) {
          const r = slot.getBoundingClientRect();
          if (r.width > 0) css = `${r.left}|${r.top}|${r.width}|${r.height}|0`;
        } else if (sn.slotKey !== tr.key && (tr.mode !== "audio" || sn.collapsed)) {
          const isCircle = sn.collapsed;
          const w = isCircle ? CIRCLE : floatWidth();
          const h = isCircle ? CIRCLE : Math.round((w * 9) / 16);
          const p = clamp(pos.current ?? { x: window.innerWidth - w - 12, y: Math.max(MARGIN, bottomEdge() - h - 12) }, w, h);
          css = `${p.x}|${p.y}|${w}|${h}|${isCircle ? 2 : 1}`;
        }
      }
      if (css === last) return;
      last = css;
      if (css === "none") {
        box.style.display = "none";
        return;
      }
      const [l, tp, w, h, fl] = css.split("|");
      const framed = fl !== "0";
      box.style.setProperty("--pad", framed ? "3px" : "0px");
      Object.assign(box.style, {
        display: "block",
        left: `${l}px`,
        top: `${tp}px`,
        width: `${w}px`,
        height: `${h}px`,
        borderRadius: fl === "2" ? "50%" : fl === "1" ? "14px" : "0",
        boxShadow: framed ? "0 6px 24px rgba(12,96,60,0.45), 0 0 0 1px rgba(255,243,196,0.35)" : "none",
        background: framed ? FRAME : "#000",
        backgroundSize: framed ? "300% 300%" : "auto",
        animation: framed ? "hg-sheen 7s linear infinite" : "none",
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setFrame = useCallback((f: HTMLIFrameElement | null) => engine.setYoutubeFrame(f), []);

  const size = () => {
    const w = s.collapsed ? CIRCLE : floatWidth();
    return { w, h: s.collapsed ? CIRCLE : Math.round((w * 9) / 16) };
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    const { w, h } = size();
    pos.current = clamp({ x: d.x + dx, y: d.y + dy }, w, h);
  };
  const save = () => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos.current));
    } catch {
      /* 儲存不了就算了 */
    }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) return save();
    if (s.collapsed) restore(); // 點一下小圓圖＝恢復原本的迷你播放器
    else if (t) router.push(`/learn/${t.courseId}/${t.lessonId}`); // 點一下小視窗＝回到課程頁
  };
  /** 縮小／恢復時，讓小圓圖貼著小視窗的右上角（手指剛按的位置附近），恢復時再貼回來。 */
  const resizeAround = (toCircle: boolean) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const from = toCircle ? floatWidth() : CIRCLE;
    const to = toCircle ? CIRCLE : floatWidth();
    const right = (pos.current?.x ?? r.left) + from;
    const toH = toCircle ? CIRCLE : Math.round((to * 9) / 16);
    pos.current = clamp({ x: right - to, y: pos.current?.y ?? r.top }, to, toH);
    save();
  };
  const minimize = () => {
    if (!isAudio) resizeAround(true);
    engine.setCollapsed(true);
  };
  const restore = () => {
    if (!isAudio) resizeAround(false);
    engine.setCollapsed(false);
  };
  const stop = (e: PointerEvent) => e.stopPropagation();

  if (typeof document === "undefined") return null;
  const yt = t?.mode === "youtube" && t.playback.kind === "youtube" ? t.playback : null;
  const range = yt ? `${yt.start ? `&start=${yt.start}` : ""}${yt.end ? `&end=${yt.end}` : ""}` : "";
  const art = s.artworkUrl ? (/^(https?:|blob:|data:)/.test(s.artworkUrl) ? s.artworkUrl : s.artworkUrl) : "/icon-512.png";
  return createPortal(
    <div ref={boxRef} style={{ position: "fixed", left: 0, top: 0, display: "none", zIndex: 1000, overflow: "hidden", background: "#000" }}>
      <style>{"@keyframes hg-spin{to{transform:rotate(360deg)}}@keyframes hg-sheen{0%{background-position:0% 50%}100%{background-position:300% 50%}}"}</style>
      <div style={{ position: "absolute", inset: "var(--pad, 0px)", borderRadius: "inherit", overflow: "hidden", background: "#000" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0, display: yt ? "none" : "block" }} />
      {yt ? (
        <iframe
          key={t!.key}
          ref={setFrame}
          title="課程影片"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt.videoId)}?controls=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&rel=0&modestbranding=1&autoplay=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}${range}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : null}
      {circle ? (
        <div style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "grab", background: "#000", borderRadius: "50%", overflow: "hidden" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)} role="button" aria-label="恢復迷你播放器（可按住拖曳移動）">
          <img src={art} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", animation: "hg-spin 8s linear infinite", animationPlayState: s.playing ? "running" : "paused", pointerEvents: "none" }} />
          {!s.playing ? <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", color: "#fff", font: "700 20px sans-serif", pointerEvents: "none" }}>▶</div> : null}
        </div>
      ) : null}
      {windowed ? (
        <div style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "grab" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)} role="button" aria-label="回到課程頁（可按住拖曳移動）">
          <button type="button" aria-label="關閉播放" style={{ ...btn, top: 4, right: 4, width: 40, height: 40 }} onPointerDown={stop} onPointerUp={stop} onClick={() => engine.close()}>
            ✕
          </button>
          <button type="button" aria-label="縮小成小圓圖" style={{ ...btn, top: 48, right: 4, width: 40, height: 40 }} onPointerDown={stop} onPointerUp={stop} onClick={minimize}>
            ─
          </button>
          <button type="button" aria-label={s.playing ? "暫停" : "播放"} style={{ ...btn, left: "50%", top: "50%", width: 52, height: 52, transform: "translate(-50%,-50%)" }} onPointerDown={stop} onPointerUp={stop} onClick={() => engine.toggle()}>
            {s.playing ? "❚❚" : "▶"}
          </button>
        </div>
      ) : null}
      </div>
    </div>,
    document.body,
  );
}
