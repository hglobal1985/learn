import { useEffect, useRef, useState } from "react";
import type { Rect } from "./image-tools";

const MIN = 32;
type Drag = { kind: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; box: Rect };

/**
 * 裁切框（網頁版）：拖曳框內移動、拖四個角縮放；aspect 有值時鎖定比例（例如 16/9）。
 * value／onChange 使用原圖像素座標。
 */
export function EdmCropper({ src, imgW, imgH, aspect, value, onChange }: { src: string; imgW: number; imgH: number; aspect: number | null; value: Rect; onChange: (r: Rect) => void }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ w: 320, h: 320 });
  const drag = useRef<Drag | null>(null);
  const maxW = 420;
  const maxH = 460;
  useEffect(() => {
    const s = Math.min(maxW / imgW, maxH / imgH, 1);
    setView({ w: Math.round(imgW * s), h: Math.round(imgH * s) });
  }, [imgW, imgH]);
  const k = view.w / imgW; // 原圖像素 → 畫面像素
  const box = { x: value.x * k, y: value.y * k, w: value.w * k, h: value.h * k };
  const emit = (b: Rect) => onChange({ x: Math.round(b.x / k), y: Math.round(b.y / k), w: Math.max(1, Math.round(b.w / k)), h: Math.max(1, Math.round(b.h / k)) });

  const start = (kind: Drag["kind"]) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, startX: e.clientX, startY: e.clientY, box: { ...box } };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const b = d.box;
    if (d.kind === "move") {
      emit({ x: Math.min(Math.max(0, b.x + dx), view.w - b.w), y: Math.min(Math.max(0, b.y + dy), view.h - b.h), w: b.w, h: b.h });
      return;
    }
    // 對角固定，另一角跟著指標；鎖比例時以寬度為準。
    const fx = d.kind === "nw" || d.kind === "sw" ? b.x + b.w : b.x;
    const fy = d.kind === "nw" || d.kind === "ne" ? b.y + b.h : b.y;
    const px = Math.min(Math.max(0, (d.kind === "nw" || d.kind === "sw" ? b.x : b.x + b.w) + dx), view.w);
    const py = Math.min(Math.max(0, (d.kind === "nw" || d.kind === "ne" ? b.y : b.y + b.h) + dy), view.h);
    let w = Math.max(MIN, Math.abs(px - fx));
    let h = Math.max(MIN, Math.abs(py - fy));
    const left = px < fx;
    const up = py < fy;
    if (aspect) {
      h = w / aspect;
      const roomW = left ? fx : view.w - fx;
      const roomH = up ? fy : view.h - fy;
      if (h > roomH) (h = roomH), (w = h * aspect);
      if (w > roomW) (w = roomW), (h = w / aspect);
    }
    emit({ x: left ? fx - w : fx, y: up ? fy - h : fy, w, h });
  };
  const end = () => (drag.current = null);

  const handle = (kind: "nw" | "ne" | "sw" | "se", style: React.CSSProperties) => (
    <div onPointerDown={start(kind)} style={{ position: "absolute", width: 22, height: 22, background: "#fff", border: "2px solid #2F5D3A", borderRadius: 11, touchAction: "none", cursor: kind === "nw" || kind === "se" ? "nwse-resize" : "nesw-resize", ...style }} />
  );
  return (
    <div ref={wrap} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ position: "relative", width: view.w, height: view.h, overflow: "hidden", userSelect: "none", touchAction: "none", background: "#000", borderRadius: 8, margin: "0 auto" }}>
      <img src={src} alt="" draggable={false} style={{ width: view.w, height: view.h, display: "block" }} />
      <div onPointerDown={start("move")} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", border: "2px solid #fff", cursor: "move", touchAction: "none" }}>
        {handle("nw", { left: -11, top: -11 })}
        {handle("ne", { right: -11, top: -11 })}
        {handle("sw", { left: -11, bottom: -11 })}
        {handle("se", { right: -11, bottom: -11 })}
      </div>
    </div>
  );
}
