/**
 * 網頁版圖片處理（在管理員的瀏覽器內完成，伺服器只收處理好的圖）：
 * 讀取 JPG／PNG／WebP／HEIC → 依長邊壓縮 → 裁切 → 合成 16:9 封面。上傳後不保留原始檔。
 */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const EDM_MAX_SIDE = 2048; // EDM 原圖（小字與 QR code 要看得清楚）
export const BG_MAX_SIDE = 1024; // 底圖與封面
export const COVER_W = 1024;
export const COVER_H = 576; // 16:9

export type Rect = { x: number; y: number; w: number; h: number };

const isHeic = (f: File) => /^image\/hei[cf]$/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/** 讀入圖片檔（含 iPhone 的 HEIC，轉成 JPEG 再讀）。 */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  if (file.size > MAX_INPUT_BYTES) throw Error("圖片大小需在 20MB 以內");
  let blob: Blob = file;
  if (isHeic(file)) {
    try {
      const { default: heic2any } = await import("heic2any");
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      blob = Array.isArray(out) ? out[0] : out;
    } catch {
      throw Error("無法讀取這張 HEIC 圖片，請改用 JPG 或 PNG");
    }
  } else if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw Error("請選擇 JPG、PNG、WebP 或 HEIC 圖片");
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(Error("無法讀取這張圖片，請換一張"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export async function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("底圖載入失敗"));
    img.src = url;
  });
}

const toBlob = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(Error("圖片處理失敗"))), "image/jpeg", quality));

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff"; // PNG 透明處墊白，避免變黑
  ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}

/** 等比縮到長邊不超過 maxSide（不放大），輸出 JPEG。 */
export async function compress(img: HTMLImageElement, maxSide: number, quality = 0.88): Promise<Blob> {
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const { c, ctx } = canvasOf(Math.max(1, Math.round(img.naturalWidth * s)), Math.max(1, Math.round(img.naturalHeight * s)));
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return toBlob(c, quality);
}

/** 把圖片的 crop 區域（原圖像素；null＝整張）放進 16:9 封面：有底圖就等比置中在底圖上，沒有底圖就鋪滿（裁成 16:9）。 */
export async function composeCover(edm: HTMLImageElement, crop: Rect | null, bg: HTMLImageElement | null, quality = 0.88): Promise<Blob> {
  const { c, ctx } = canvasOf(COVER_W, COVER_H);
  const src = crop ?? { x: 0, y: 0, w: edm.naturalWidth, h: edm.naturalHeight };
  if (!bg) {
    ctx.drawImage(edm, src.x, src.y, src.w, src.h, 0, 0, COVER_W, COVER_H);
    return toBlob(c, quality);
  }
  const k = Math.max(COVER_W / bg.naturalWidth, COVER_H / bg.naturalHeight); // 底圖鋪滿（cover）
  const bw = bg.naturalWidth * k;
  const bh = bg.naturalHeight * k;
  ctx.drawImage(bg, (COVER_W - bw) / 2, (COVER_H - bh) / 2, bw, bh);
  const maxW = COVER_W * 0.9;
  const maxH = COVER_H * 0.9;
  const s = Math.min(maxW / src.w, maxH / src.h);
  const w = src.w * s;
  const h = src.h * s;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(edm, src.x, src.y, src.w, src.h, (COVER_W - w) / 2, (COVER_H - h) / 2, w, h);
  return toBlob(c, quality);
}
