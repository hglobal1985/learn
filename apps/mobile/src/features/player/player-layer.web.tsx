import { router } from "expo-router";
import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useSession } from "@/state/session";
import { engine } from "./engine.web";
import { usePlayer } from "./use-player";

const POS_KEY = "hglobal:learn:mini-pos";
const MARGIN = 8;

type Pos = { x: number; y: number };
const floatWidth = () => Math.round(Math.min(240, Math.max(180, window.innerWidth * 0.55)));

function defaultPos(w: number, h: number): Pos {
  const bar = document.querySelector('[role="tablist"]');
  const bottom = bar ? bar.getBoundingClientRect().top : window.innerHeight;
  return { x: window.innerWidth - w - 12, y: Math.max(MARGIN, bottom - h - 12) };
}
const clamp = (p: Pos, w: number, h: number): Pos => ({
  x: Math.min(window.innerWidth - w - MARGIN, Math.max(MARGIN, p.x)),
  y: Math.min(window.innerHeight - h - MARGIN, Math.max(MARGIN, p.y)),
});

const btn: CSSProperties = { position: "absolute", border: 0, borderRadius: 999, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation", font: "700 16px sans-serif" };

/**
 * Web 全站播放畫面層（只有一份、永遠存在）：
 * - 在課程頁：疊在頁面上方釘住的影片區塊上（內嵌，用瀏覽器原生控制列）。
 * - 離開課程頁：縮成右下角浮動小視窗，手指按住可任意拖曳位置；點一下回到課程頁；有播放／暫停與關閉。
 * - 純音檔不顯示畫面（由底部迷你列控制）。
 */
export function PlayerLayer() {
  const s = usePlayer();
  const { ready, member } = useSession();
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pos = useRef<Pos | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const t = s.track;
  const hasPicture = !!t && t.mode !== "audio";
  const inline = hasPicture && s.slotKey === t.key;
  const floating = hasPicture && !inline;

  useEffect(() => {
    hostRef.current?.appendChild(engine.element());
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

  useEffect(() => {
    engine.element().controls = inline;
  }, [inline]);

  // 每個畫面更新時對齊位置：內嵌＝貼齊課程頁的播放區塊；浮動＝使用者拖曳過的位置。
  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const box = boxRef.current;
      if (!box) return;
      const sn = engine.getSnapshot();
      const tr = sn.track;
      let css: string;
      if (!tr || tr.mode === "audio") css = "none";
      else {
        const slot = sn.slotKey === tr.key ? engine.slotElement() : null;
        if (slot && slot.isConnected) {
          const r = slot.getBoundingClientRect();
          css = r.width > 0 ? `${r.left}|${r.top}|${r.width}|${r.height}|0` : "none";
        } else {
          const w = floatWidth();
          const h = Math.round((w * 9) / 16);
          const p = clamp(pos.current ?? defaultPos(w, h), w, h);
          css = `${p.x}|${p.y}|${w}|${h}|1`;
        }
      }
      if (css === last) return;
      last = css;
      if (css === "none") {
        box.style.display = "none";
        return;
      }
      const [l, tp, w, h, fl] = css.split("|");
      Object.assign(box.style, { display: "block", left: `${l}px`, top: `${tp}px`, width: `${w}px`, height: `${h}px`, borderRadius: fl === "1" ? "12px" : "0", boxShadow: fl === "1" ? "0 6px 24px rgba(0,0,0,0.45)" : "none" });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setFrame = useCallback((f: HTMLIFrameElement | null) => engine.setYoutubeFrame(f), []);

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
    const w = floatWidth();
    pos.current = clamp({ x: d.x + dx, y: d.y + dy }, w, Math.round((w * 9) / 16));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos.current));
      } catch {
        /* 儲存不了就算了 */
      }
    } else if (t) router.push(`/learn/${t.courseId}/${t.lessonId}`); // 點一下＝回到課程頁
  };
  const stop = (e: PointerEvent) => e.stopPropagation();

  if (typeof document === "undefined") return null;
  const yt = t?.mode === "youtube" && t.playback.kind === "youtube" ? t.playback : null;
  const range = yt ? `${yt.start ? `&start=${yt.start}` : ""}${yt.end ? `&end=${yt.end}` : ""}` : "";
  return createPortal(
    <div ref={boxRef} style={{ position: "fixed", left: 0, top: 0, display: "none", zIndex: 1000, overflow: "hidden", background: "#000" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0, display: yt ? "none" : "block" }} />
      {yt ? (
        <iframe
          key={t!.key}
          ref={setFrame}
          title="課程影片"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt.videoId)}?rel=0&modestbranding=1&autoplay=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}${range}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : null}
      {floating ? (
        <div style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "grab" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => (drag.current = null)} role="button" aria-label="回到課程頁（可按住拖曳移動）">
          <button type="button" aria-label="關閉播放" style={{ ...btn, top: 4, right: 4, width: 40, height: 40 }} onPointerDown={stop} onPointerUp={stop} onClick={() => engine.close()}>
            ✕
          </button>
          <button type="button" aria-label={s.playing ? "暫停" : "播放"} style={{ ...btn, left: "50%", top: "50%", width: 52, height: 52, transform: "translate(-50%,-50%)" }} onPointerDown={stop} onPointerUp={stop} onClick={() => engine.toggle()}>
            {s.playing ? "❚❚" : "▶"}
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
