// 把 Expo Web 輸出（apps/mobile/dist）打包成 Worker 模組，部署時不需另外上傳靜態資源。
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("../../mobile/dist/", import.meta.url).pathname;
const out = new URL("../.generated/static-files.js", import.meta.url).pathname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
};

const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const files = {};
let bytes = 0;
for (const file of walk(root)) {
  const path = "/" + relative(root, file).split("\\").join("/");
  const data = readFileSync(file);
  bytes += data.length;
  files[path] = { type: types[extname(file).toLowerCase()] ?? "application/octet-stream", data: data.toString("base64") };
}
// 桌面／主畫面圖示：Expo 單頁輸出不會自動加這些標籤，這裡統一補上（網頁「加到主畫面」與瀏覽器分頁都用同一個圖案）。
if (files["/index.html"]) {
  const tags = [
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>',
    '<link rel="manifest" href="/manifest.webmanifest"/>',
    '<meta name="theme-color" content="#2F5D3A"/>',
    '<meta name="apple-mobile-web-app-capable" content="yes"/>',
    '<meta name="apple-mobile-web-app-title" content="寰宇行動大學"/>',
    // 一般網址分享到 LINE 等的預設預覽（短網址的預覽由 Worker 依內容替換，見 src/og.ts）。
    '<meta name="description" content="寰宇行動大學"/>',
    '<meta property="og:site_name" content="寰宇行動大學"/>',
    '<meta property="og:type" content="website"/>',
    '<meta property="og:title" content="寰宇行動大學"/>',
    '<meta property="og:description" content="寰宇行動大學"/>',
    '<meta property="og:image" content="https://learn.hglobal1985.com/icon-512.png"/>',
  ].join("");
  const html = Buffer.from(files["/index.html"].data, "base64").toString("utf8");
  let out = html;
  if (!out.includes("apple-touch-icon")) out = out.replace("</head>", `${tags}</head>`);
  // iPhone 的瀏海／狀態列／底部橫條「安全區」：viewport-fit=cover 才能讓 App 內量到安全區；狀態列用半透明樣式，畫面延伸到狀態列底下，
  // 由 App 自己（app/_layout.tsx）把標題列與狀態列底色處理好。100dvh：手機網址列伸縮時，畫面高度跟著可視範圍，底部選單不會被推出畫面或留白。
  out = out.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>');
  if (!out.includes("apple-mobile-web-app-status-bar-style")) out = out.replace("</head>", '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/></head>');
  if (!out.includes("hg-dvh")) out = out.replace("</head>", '<style id="hg-dvh">@supports (height:100dvh){html,body,#root{height:100dvh}}</style></head>');
  files["/index.html"].data = Buffer.from(out, "utf8").toString("base64");
}
if (!files["/index.html"]) throw Error("找不到 apps/mobile/dist/index.html，請先執行 npm run build:web -w @learn/mobile");
mkdirSync(new URL("../.generated/", import.meta.url), { recursive: true });
writeFileSync(out, `export const files = ${JSON.stringify(files)};\n`);
console.log(`embedded ${Object.keys(files).length} files, ${(bytes / 1024).toFixed(0)} KiB`);
