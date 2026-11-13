/**
 * 偵測 YouTube 影片長度（秒）：建立一個看不見的 YouTube 播放器（靜音、不播放），
 * 透過 postMessage 讀取它回報的影片長度，最多等 12 秒。讓課程與章節能顯示預估分鐘數。
 */
export function detectYoutubeSeconds(videoId: string): Promise<number | null> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;left:-9999px;top:0;width:200px;height:120px;border:0;opacity:0;pointer-events:none";
    frame.setAttribute("aria-hidden", "true");
    frame.allow = "autoplay";
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?controls=0&mute=1&enablejsapi=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
    let done = false;
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
      frame.remove();
      resolve(v);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const dur = d?.info?.duration;
        if (typeof dur === "number" && dur > 0) finish(dur);
        else if (d?.info?.videoData?.errorCode) finish(null);
      } catch {
        /* 其他訊息忽略 */
      }
    };
    window.addEventListener("message", onMsg);
    frame.addEventListener("load", () => frame.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*"));
    const timer = setTimeout(() => finish(null), 12000);
    document.body.appendChild(frame);
  });
}
