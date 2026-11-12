import type { AttachmentType } from "./contract.ts";

/** 依網址判斷附件類型（只看網域與路徑，不連線）。 */
export function classifyLink(u: URL): AttachmentType {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.toLowerCase();
  const is = (d: string) => host === d || host.endsWith(`.${d}`);
  if (host === "youtu.be" || is("youtube.com") || is("youtube-nocookie.com")) return "youtube";
  if (is("vimeo.com")) return "vimeo";
  if (is("canva.com") || host === "canva.link") return "canva";
  if (host === "docs.google.com") {
    if (path.startsWith("/presentation")) return "google_slides";
    if (path.startsWith("/document")) return "google_docs";
    if (path.startsWith("/spreadsheets")) return "google_sheets";
    if (path.startsWith("/forms")) return "google_forms";
    return "web";
  }
  if (host === "forms.gle") return "google_forms";
  if (host === "drive.google.com") return "google_drive";
  if (is("notion.so") || is("notion.site")) return "notion";
  if (path.endsWith(".pdf")) return "pdf";
  return "web";
}

/** 只收 https 網址；回傳整理過的網址，不合格回 null。 */
export function parseHttpsUrl(input: unknown): URL | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s || s.length > 500) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

export const LINK_DEFAULT_TITLE: Record<AttachmentType, string> = {
  youtube: "YouTube 影片",
  vimeo: "Vimeo 影片",
  canva: "Canva 簡報",
  google_slides: "Google 簡報",
  google_docs: "Google 文件",
  google_sheets: "Google 試算表",
  google_forms: "Google 表單",
  google_drive: "Google 雲端硬碟",
  notion: "Notion 頁面",
  web: "網頁連結",
  pdf: "PDF 文件",
  word: "Word 文件",
  ppt: "PowerPoint 簡報",
  excel: "Excel 試算表",
  zip: "壓縮檔",
  image: "圖片",
  text: "文字檔",
  file: "檔案",
};
