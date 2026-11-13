import { useRef, useState, type PointerEvent } from "react";

/**
 * 選「EDM 預設停留位置」：顯示整張 EDM，上面有一個固定 16:9 寬度的取景框（就是課程介紹頁上方實際看到的範圍），
 * 上下拖曳取景框，學員一進課程介紹頁就停在這個位置。value／onChange 是取景框上緣占原圖高度的比例（0～1）。
 */
export function ViewWindowPicker({ src, imgW, imgH, value, onChange, width = 280 }: { src: string; imgW: number; imgH: number; value: number; onChange: (v: number) => void; width?: number }) {
  const shownH = (width * imgH) / imgW;
  const winH = Math.min(shownH, (width * 9) / 16);
  const room = Math.max(0, shownH - winH);
  const top = Math.min(room, Math.max(0, value * shownH));
  const drag = useRef<{ y: number; top: number } | null>(null);
  const [active, setActive] = useState(false);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, top };
    setActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !shownH) return;
    const next = Math.min(room, Math.max(0, d.top + (e.clientY - d.y)));
    onChange(next / shownH);
  };
  const up = () => {
    drag.current = null;
    setActive(false);
  };
  return (
    <div style={{ position: "relative", width, height: shownH, overflow: "hidden", borderRadius: 8, userSelect: "none", touchAction: "none" }}>
      <img src={src} alt="EDM" draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        role="slider"
        aria-label="EDM 預設位置（上下拖曳）"
        style={{ position: "absolute", left: 0, top, width: "100%", height: winH, boxSizing: "border-box", border: "3px solid #f2c063", boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)", cursor: active ? "grabbing" : "grab", borderRadius: 4 }}
      />
    </div>
  );
}
