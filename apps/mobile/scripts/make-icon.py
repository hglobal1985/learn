"""寰宇行動大學專屬圖示：學士帽 + 環繞的軌道弧線（呼應寰宇 logo 的環），配色取自寰宇 logo 與網站主色。
執行：python3 apps/mobile/scripts/make-icon.py  → 產生 assets/ 與 public/ 的所有圖示。需要 Pillow。"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json, os, math

S = 4096  # 4 倍超取樣
K = S / 1024
GREEN_D, GREEN, OLIVE = (9, 74, 46), (20, 102, 63), (72, 108, 72)
ORANGE, GOLD, SALMON, CREAM = (204, 108, 12), (242, 220, 39), (240, 168, 132), (255, 248, 230)

def P(x, y): return (x * K, y * K)
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def vgrad(w, h, top, bot):
    g = Image.new("RGB", (1, h))
    for y in range(h): g.putpixel((0, y), lerp(top, bot, y / (h - 1)))
    return g.resize((w, h))

def hgrad(w, h, stops):
    g = Image.new("RGB", (w, 1))
    for x in range(w):
        t = x / (w - 1) * (len(stops) - 1); i = min(int(t), len(stops) - 2)
        g.putpixel((x, 0), lerp(stops[i], stops[i + 1], t - i))
    return g.resize((w, h))

def mask_poly(pts, blur=0):
    m = Image.new("L", (S, S), 0); ImageDraw.Draw(m).polygon([P(*p) for p in pts], fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m

def paste_fill(base, fill_img, mask): base.paste(fill_img, (0, 0), mask)

def build_mark(bg=True):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if bg:
        rr = Image.new("L", (S, S), 0)
        ImageDraw.Draw(rr).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.225), fill=255)
        img.paste(vgrad(S, S, GREEN, GREEN_D), (0, 0), rr)
    # 軌道弧線（漸層描邊，傾斜橢圓）
    ring = Image.new("L", (S, S), 0); d = ImageDraw.Draw(ring)
    d.ellipse((P(110, 330)[0], P(110, 330)[1], P(914, 760)[0], P(914, 760)[1]), outline=255, width=int(34 * K))
    ring = ring.rotate(-18, center=(S / 2, S / 2 + 40 * K), resample=Image.BICUBIC)
    img.paste(hgrad(S, S, [GOLD, ORANGE, SALMON]), (0, 0), ring)
    # 帽身（下方的圓筒）
    body = [(352, 530), (352, 668), (385, 712), (512, 748), (639, 712), (672, 668), (672, 530)]
    paste_fill(img, vgrad(S, S, (232, 130, 36), (170, 80, 10)), mask_poly(body))
    # 帽板厚度（側面）與帽板
    paste_fill(img, vgrad(S, S, (214, 196, 150), (180, 160, 110)), mask_poly([(120, 420), (512, 610), (904, 420), (904, 468), (512, 658), (120, 468)]))
    paste_fill(img, vgrad(S, S, CREAM, (238, 224, 188)), mask_poly([(512, 215), (904, 420), (512, 610), (120, 420)]))
    # 帽板上的中心線與鈕扣
    ImageDraw.Draw(img).line([P(512, 215), P(512, 610)], fill=(225, 210, 170, 90), width=int(5 * K))
    # 流蘇：從鈕扣沿帽板右側垂下
    dr = ImageDraw.Draw(img)
    dr.line([P(512, 412), P(780, 470), P(842, 560)], fill=GOLD + (255,), width=int(15 * K), joint="curve")
    dr.ellipse((P(494, 394)[0], P(494, 394)[1], P(530, 430)[0], P(530, 430)[1]), fill=GOLD + (255,))
    for dx, col in [(-22, ORANGE), (-7, GOLD), (8, ORANGE), (23, GOLD)]:
        dr.line([P(842 + dx * 0.4, 556), P(842 + dx, 690)], fill=col + (255,), width=int(13 * K))
    dr.ellipse((P(822, 535)[0], P(822, 535)[1], P(862, 575)[0], P(862, 575)[1]), fill=ORANGE + (255,))
    # 前景弧線（讓軌道從帽子前面繞過一小段，產生環繞感）
    front = ring.copy(); fm = Image.new("L", (S, S), 0)
    ImageDraw.Draw(fm).polygon([P(0, 640), P(1024, 640), P(1024, 1024), P(0, 1024)], fill=255)
    front = ImageChops.multiply(front, fm)
    img.paste(hgrad(S, S, [GOLD, ORANGE, SALMON]), (0, 0), front)
    return img

def out(img, size, path, bg=(255, 255, 255), flat=True, ratio=1.0):
    im = img.resize((int(size * ratio), int(size * ratio)), Image.LANCZOS)
    if ratio == 1.0 and not flat: im.save(path, optimize=True); return
    c = Image.new("RGBA", (size, size), bg + (255,) if flat else (0, 0, 0, 0))
    c.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    (c.convert("RGB") if flat else c).save(path, optimize=True)

here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
icon = build_mark(bg=True)
icon.resize((1024, 1024), Image.LANCZOS).convert("RGBA").save(f"{root}/assets/logo.png", optimize=True)   # 首頁標題旁的標誌
for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")]:
    out(icon, size, f"{root}/public/{name}", flat=True, bg=(246, 245, 240) if False else (255, 255, 255)) if False else icon.resize((size, size), Image.LANCZOS).save(f"{root}/public/{name}", optimize=True)
out(icon, 512, f"{root}/public/icon-maskable-512.png", bg=(20, 102, 63), flat=True, ratio=0.74)       # 遮罩圖示：滿版綠底，主體縮在安全區
icon.resize((1024, 1024), Image.LANCZOS).convert("RGB").save(f"{root}/assets/icon.png", optimize=True)   # iOS 圖示（不可透明）
fg = build_mark(bg=False); out(fg, 1024, f"{root}/assets/adaptive-icon.png", flat=False, ratio=0.66)        # Android 前景（透明）
icon.resize((48, 48), Image.LANCZOS).save(f"{root}/assets/favicon.png", optimize=True)
icon.resize((1024, 1024), Image.LANCZOS).save("/tmp/learn-icon-preview.png")
print("done")
