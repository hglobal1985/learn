/**
 * 網頁版圖片處理（在管理員的瀏覽器內完成，伺服器只收處理好的圖）：
 * 讀取 JPG／PNG／WebP／HEIC → 裁切 → 依長邊壓縮。上傳後不保留原始檔。
 */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const EDM_MAX_SIDE = 2048; // EDM 原圖（小字與 QR code 要看得清楚）
export const COVER_MAX_SIDE = 1024; // 16:9 封面（課程清單縮圖）長邊

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

/** 取圖片的 crop 區域（原圖像素；null＝整張），等比縮到長邊不超過 maxSide，輸出 JPEG。 */
export async function cropCompress(img: HTMLImageElement, crop: Rect | null, maxSide: number, quality = 0.9): Promise<Blob> {
  const src = crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const s = Math.min(1, maxSide / Math.max(src.w, src.h));
  const { c, ctx } = canvasOf(Math.max(1, Math.round(src.w * s)), Math.max(1, Math.round(src.h * s)));
  ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, c.width, c.height);
  return toBlob(c, quality);
}
