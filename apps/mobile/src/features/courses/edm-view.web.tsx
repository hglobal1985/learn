import { resolveUrl } from "@/api/client";
import { AppText } from "@/ui";

/** 網頁：直接用 <img> 顯示 EDM，電腦按右鍵「另存圖片」、手機長按即可下載。 */
export function EdmView({ url }: { url: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <img src={resolveUrl(url)} alt="課程海報" style={{ width: "100%", maxWidth: 560, height: "auto", borderRadius: 12, margin: "0 auto", display: "block" }} />
      <AppText variant="caption" tone="muted">
        電腦：在圖片上按右鍵「另存圖片」；手機：長按圖片即可儲存。
      </AppText>
    </div>
  );
}
