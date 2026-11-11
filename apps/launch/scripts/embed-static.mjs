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
if (!files["/index.html"]) throw Error("找不到 apps/mobile/dist/index.html，請先執行 npm run build:web -w @learn/mobile");
mkdirSync(new URL("../.generated/", import.meta.url), { recursive: true });
writeFileSync(out, `export const files = ${JSON.stringify(files)};\n`);
console.log(`embedded ${Object.keys(files).length} files, ${(bytes / 1024).toFixed(0)} KiB`);
