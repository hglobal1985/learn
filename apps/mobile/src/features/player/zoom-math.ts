/** 影片放大（雙指／滾輪）的共用計算：縮小不低於 100%，放大後可拖曳查看其他區域，永遠不拖出影片範圍外。 */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export type Zoom = { s: number; x: number; y: number };
export const IDENTITY: Zoom = { s: 1, x: 0, y: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 把平移限制在影片範圍內（w、h 是影片區塊的寬高）。 */
export function clampZoom(z: Zoom, w: number, h: number): Zoom {
  const s = clamp(z.s, MIN_ZOOM, MAX_ZOOM);
  return { s, x: clamp(z.x, w * (1 - s), 0), y: clamp(z.y, h * (1 - s), 0) };
}

/** 以 (px, py)（區塊內座標）為中心縮放到新的倍率，讓手指／游標下的那一點保持不動。 */
export function zoomAt(z: Zoom, nextScale: number, px: number, py: number, w: number, h: number): Zoom {
  const s = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
  const k = s / z.s;
  return clampZoom({ s, x: px - (px - z.x) * k, y: py - (py - z.y) * k }, w, h);
}
