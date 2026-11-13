/**
 * 從音檔內嵌的專輯封面（MP3 的 ID3 APIC、M4A 的 covr）取出圖片，給手機通知欄的播放器顯示。
 * 只讀檔案開頭的一小段（Range 請求），找不到就回傳 null（呼叫端改用課程 EDM）。
 */
const MAX_TAG = 6 * 1024 * 1024;

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
const synchsafe = (b: Uint8Array, o: number) => ((b[o]! & 0x7f) << 21) | ((b[o + 1]! & 0x7f) << 14) | ((b[o + 2]! & 0x7f) << 7) | (b[o + 3]! & 0x7f);
const be32 = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

async function range(url: string, from: number, to: number): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { headers: { range: `bytes=${from}-${to}` } });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function fromId3(b: Uint8Array): Uint8Array | null {
  const ver = b[3]!;
  const total = Math.min(b.length, 10 + synchsafe(b, 6));
  let o = 10;
  if (b[5]! & 0x40) o += ver === 4 ? synchsafe(b, 10) : 4 + be32(b, 10); // 略過擴充標頭
  while (o + 10 < total) {
    const id = ascii(b, o, 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = ver === 4 ? synchsafe(b, o + 4) : be32(b, o + 4);
    if (size <= 0 || o + 10 + size > b.length) break;
    if (id === "APIC") {
      const f = b.subarray(o + 10, o + 10 + size);
      const enc = f[0]!;
      let p = 1;
      while (p < f.length && f[p] !== 0) p++; // MIME
      p += 2; // 結尾的 0 與圖片類型
      if (enc === 1 || enc === 2) {
        while (p + 1 < f.length && !(f[p] === 0 && f[p + 1] === 0)) p += 2;
        p += 2;
      } else {
        while (p < f.length && f[p] !== 0) p++;
        p += 1;
      }
      const img = f.subarray(p);
      return img.length > 100 ? img : null;
    }
    o += 10 + size;
  }
  return null;
}

function fromMp4(b: Uint8Array): Uint8Array | null {
  for (let i = 4; i + 24 < b.length; i++) {
    if (b[i] === 0x63 && b[i + 1] === 0x6f && b[i + 2] === 0x76 && b[i + 3] === 0x72) {
      // 'covr' → [size]['data'][flags][locale][image]
      const size = be32(b, i + 4);
      if (ascii(b, i + 8, 4) !== "data" || size < 24) continue;
      const img = b.subarray(i + 20, Math.min(b.length, i + 4 + size));
      if (img.length > 100) return img;
    }
  }
  return null;
}

/** M4A：沿著最上層的 atom 一路跳到 moov（很多檔案的 moov 在檔尾），只下載 moov 這一塊來找封面。 */
async function mp4Cover(url: string): Promise<Uint8Array | null> {
  let at = 0;
  for (let hops = 0; hops < 12; hops++) {
    const h = await range(url, at, at + 15);
    if (!h || h.length < 8) return null;
    let size = be32(h, 0);
    const type = ascii(h, 4, 4);
    if (size === 1 && h.length >= 16) size = be32(h, 8) * 2 ** 32 + be32(h, 12);
    if (size < 8) return null;
    if (type === "moov") {
      if (size > MAX_TAG) return null;
      const moov = await range(url, at, at + size - 1);
      return moov ? fromMp4(moov) : null;
    }
    at += size;
  }
  return null;
}

/** 回傳可直接當圖片網址使用的 blob: 網址（用完請 URL.revokeObjectURL）；沒有內嵌封面回傳 null。 */
export async function embeddedCover(url: string): Promise<string | null> {
  const head = await range(url, 0, 9);
  if (!head || head.length < 10) return null;
  let img: Uint8Array | null = null;
  if (ascii(head, 0, 3) === "ID3") {
    const size = 10 + synchsafe(head, 6);
    if (size > MAX_TAG) return null;
    const tag = await range(url, 0, size - 1);
    img = tag ? fromId3(tag) : null;
  } else if (ascii(head, 4, 4) === "ftyp") {
    img = await mp4Cover(url);
  }
  if (!img) return null;
  const type = sniff(img);
  return type ? URL.createObjectURL(new Blob([img as BlobPart], { type })) : null;
}
