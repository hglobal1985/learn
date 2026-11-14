import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { api, apiBlob, resolveUrl, type Lesson } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { radius, space } from "@/theme/tokens";
import { AppText, Button } from "@/ui";
import { BottomSheet } from "@/ui/bottom-sheet";
import { EdmCropper } from "./edm-cropper.web";
import { COVER_MAX_SIDE, cropCompress, loadImage, loadImageUrl, type Rect } from "./image-tools";

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const POSTER_ASPECT = 3 / 4; // 直式封面
const POSTER_MAX_SIDE = 1280;

/** 置中、盡量大的指定比例裁切框。 */
function defaultRect(img: HTMLImageElement, aspect: number): Rect {
  let w = Math.min(img.naturalWidth, img.naturalHeight * aspect);
  let h = w / aspect;
  if (h > img.naturalHeight) {
    h = img.naturalHeight;
    w = h * aspect;
  }
  return { x: Math.round((img.naturalWidth - w) / 2), y: Math.round((img.naturalHeight - h) / 2), w: Math.round(w), h: Math.round(h) };
}

type Job = { img: HTMLImageElement; cover: Rect; poster: Rect; step: "cover" | "poster"; usePoster: boolean };

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** 把目前分頁裡那個 YouTube 播放框的畫面截下來（電腦版 Chrome／Edge；每次要在瀏覽器跳出的視窗按「允許」分享這個分頁）。 */
async function captureIframe(iframe: HTMLIFrameElement): Promise<HTMLImageElement> {
  const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (o: unknown) => Promise<MediaStream> };
  if (!md?.getDisplayMedia) throw Error("這個瀏覽器不支援畫面擷取，請改用電腦版 Chrome 或 Edge，或自己截圖後用「上傳圖片」");
  let stream: MediaStream;
  try {
    stream = await md.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include" });
  } catch {
    throw Error("已取消擷取。請在跳出的視窗選「這個分頁」並按分享");
  }
  try {
    const track = stream.getVideoTracks()[0]!;
    if ((track.getSettings() as { displaySurface?: string }).displaySurface && (track.getSettings() as { displaySurface?: string }).displaySurface !== "browser") throw Error("請選擇「這個分頁」，不要選整個螢幕或其他視窗");
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 350)); // 等分享提示收起、畫面穩定
    const r = iframe.getBoundingClientRect();
    const sx = video.videoWidth / window.innerWidth;
    const sy = video.videoHeight / window.innerHeight;
    const w = Math.round(r.width * sx);
    const h = Math.round(r.height * sy);
    if (w < 160 || h < 90) throw Error("擷取到的畫面太小，請把視窗放大後再試");
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(video, r.left * sx, r.top * sy, w, h, 0, 0, w, h);
    return await loadImageUrl(c.toDataURL("image/jpeg", 0.95));
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/**
 * 章節封面（網頁版，課程勾選「章節各自設定封面」才會出現）：
 * 每個章節各自一張「橫式 16:9」（章節清單縮圖）與一張「直式 3:4」封面（兩種都可只設其中一種）；沒設定就用課程封面。
 * 來源：①上傳圖片　②從影片挑畫面——YouTube（拖時間軸＋截取目前畫面）、Mux（指定秒數直接截圖）。圖片在瀏覽器裁切、壓縮後才上傳。
 */
export function LessonArt({ lesson, onChanged }: { lesson: Lesson; onChanged: () => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [preview, setPreview] = useState<{ cover?: string; poster?: string }>({});
  const [frames, setFrames] = useState(false);
  const media = lesson.media;
  const canFrames = media?.type === "youtube" || media?.type === "mux";

  const start = (img: HTMLImageElement) => setJob({ img, cover: defaultRect(img, 16 / 9), poster: defaultRect(img, POSTER_ASPECT), step: "cover", usePoster: true });
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg("讀取圖片中…");
    try {
      start(await loadImage(file));
      setMsg(null);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // 裁切預覽（0.2 秒更新）。
  useEffect(() => {
    if (!job) return setPreview({});
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const [c, p] = await Promise.all([cropCompress(job.img, job.cover, 480, 0.75), cropCompress(job.img, job.poster, 480, 0.75)]);
        if (!dead) setPreview({ cover: URL.createObjectURL(c), poster: URL.createObjectURL(p) });
      } catch {
        /* 預覽失敗不影響儲存 */
      }
    }, 200);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [job?.img, job?.cover, job?.poster]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!job) return;
    setBusy(true);
    setMsg("上傳中…");
    try {
      await api("PUT", `/admin/lessons/${lesson.id}/art?part=cover`, await cropCompress(job.img, job.cover, COVER_MAX_SIDE, 0.9));
      if (job.usePoster) await api("PUT", `/admin/lessons/${lesson.id}/art?part=poster`, await cropCompress(job.img, job.poster, POSTER_MAX_SIDE, 0.9));
      setJob(null);
      setMsg(null);
      onChanged();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (part: "cover" | "poster") => {
    if (!(await confirmSheet({ title: part === "cover" ? "移除橫式封面" : "移除直式封面", message: "移除後，這個章節會改用課程封面。", confirmLabel: "移除", cancelLabel: "先不要", danger: true }))) return;
    setBusy(true);
    try {
      await api("DELETE", `/admin/lessons/${lesson.id}/art?part=${part}`);
      onChanged();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="callout" style={{ fontWeight: "700" }}>
        章節封面
      </AppText>
      <View style={styles.thumbs}>
        <View style={styles.col}>
          {lesson.coverUrl ? <Image source={{ uri: resolveUrl(lesson.coverUrl) }} style={styles.cover} resizeMode="cover" accessibilityLabel="橫式封面" /> : <View style={[styles.cover, styles.empty]}><AppText variant="caption" tone="muted">橫式 16:9{"\n"}未設定</AppText></View>}
          {lesson.coverUrl ? <Button variant="ghost" label="移除橫式" disabled={busy} onPress={() => remove("cover")} /> : null}
        </View>
        <View style={styles.col}>
          {lesson.posterUrl ? <Image source={{ uri: resolveUrl(lesson.posterUrl) }} style={styles.poster} resizeMode="cover" accessibilityLabel="直式封面" /> : <View style={[styles.poster, styles.empty]}><AppText variant="caption" tone="muted">直式 3:4{"\n"}未設定</AppText></View>}
          {lesson.posterUrl ? <Button variant="ghost" label="移除直式" disabled={busy} onPress={() => remove("poster")} /> : null}
        </View>
      </View>
      <View style={styles.buttons}>
        <Button variant="secondary" label="上傳圖片" icon="image-outline" loading={busy} disabled={busy} onPress={() => input.current?.click()} />
        {canFrames ? <Button variant="secondary" label="從影片選畫面" icon="film-outline" disabled={busy} onPress={() => setFrames(true)} /> : null}
      </View>
      {msg ? (
        <AppText variant="caption" style={{ color: "#b3261e" }}>
          {msg}
        </AppText>
      ) : null}
      <input ref={input} type="file" accept={FILE_ACCEPT} onChange={pick} style={{ display: "none" }} />

      {frames && media ? <FramePicker lesson={lesson} onClose={() => setFrames(false)} onPicked={(img) => (setFrames(false), start(img))} /> : null}

      {job ? (
        <BottomSheet onClose={() => !busy && setJob(null)}>
          <AppText variant="headline">{job.step === "cover" ? "① 橫式封面（16:9）" : "② 直式封面（3:4）"}</AppText>
          <AppText variant="caption" tone="muted">
            {job.step === "cover" ? "章節清單的縮圖。拖曳框內移動位置，拖四個角調整大小。" : "直式封面（海報用）。可以不設定，直接按「略過直式」。"}
          </AppText>
          <View style={{ maxHeight: 420, overflow: "scroll" as never }}>
            {job.step === "cover" ? (
              <EdmCropper src={job.img.src} imgW={job.img.naturalWidth} imgH={job.img.naturalHeight} aspect={16 / 9} value={job.cover} onChange={(cover) => setJob({ ...job, cover })} />
            ) : (
              <EdmCropper src={job.img.src} imgW={job.img.naturalWidth} imgH={job.img.naturalHeight} aspect={POSTER_ASPECT} value={job.poster} onChange={(poster) => setJob({ ...job, poster })} />
            )}
          </View>
          <View style={styles.previews}>
            {preview.cover ? <img src={preview.cover} alt="橫式預覽" style={{ width: 160, aspectRatio: "16 / 9", borderRadius: 8 }} /> : null}
            {preview.poster && job.usePoster ? <img src={preview.poster} alt="直式預覽" style={{ height: 90, aspectRatio: "3 / 4", borderRadius: 8 }} /> : null}
          </View>
          <View style={styles.buttons}>
            <Button variant="secondary" label="取消" disabled={busy} onPress={() => setJob(null)} />
            {job.step === "cover" ? (
              <>
                <Button variant="secondary" label="只存橫式" disabled={busy} loading={busy} onPress={saveCoverOnly} />
                <Button label="下一步：直式" icon="arrow-forward-outline" disabled={busy} onPress={() => setJob({ ...job, step: "poster", usePoster: true })} />
              </>
            ) : (
              <>
                <Button variant="secondary" label="略過直式" disabled={busy} onPress={saveCoverOnly} />
                <Button label="儲存" icon="checkmark-outline" loading={busy} disabled={busy} onPress={save} />
              </>
            )}
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );

  /** 只存橫式（直式不設定）。 */
  async function saveCoverOnly() {
    if (!job) return;
    setBusy(true);
    setMsg("上傳中…");
    try {
      await api("PUT", `/admin/lessons/${lesson.id}/art?part=cover`, await cropCompress(job.img, job.cover, COVER_MAX_SIDE, 0.9));
      setJob(null);
      setMsg(null);
      onChanged();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
}

/** 從影片選畫面：YouTube＝拖時間軸＋截取目前畫面；Mux＝指定秒數，伺服器直接給該秒的截圖。 */
function FramePicker({ lesson, onClose, onPicked }: { lesson: Lesson; onClose: () => void; onPicked: (img: HTMLImageElement) => void }) {
  const media = lesson.media!;
  const isYt = media.type === "youtube";
  const lo = lesson.start ?? 0;
  const hi = lesson.end ?? lo + Math.max(60, (lesson.minutes || 10) * 60);
  const [t, setT] = useState(lo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [playerOk, setPlayerOk] = useState(false);
  const [reload, setReload] = useState(0);
  const tRef = useRef(lo);
  const iframe = useRef<HTMLIFrameElement | null>(null);

  const cmd = (func: string, args: unknown[] = []) => iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  // YouTube：先靜音自動播放（播放器才會真的啟動、畫面才不會一直是黑的），開始播放後停在選定的那一秒；之後時間軸一動就跳過去再暫停。
  const started = useRef(false);
  useEffect(() => {
    if (!isYt) return;
    const onMsg = (e: MessageEvent) => {
      if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin) || e.source !== iframe.current?.contentWindow) return;
      let d: { event?: string; info?: { playerState?: number } | number };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      const state = d.event === "onStateChange" ? (d.info as number) : d.event === "infoDelivery" && typeof d.info === "object" ? d.info?.playerState : undefined;
      if (state === 1 && !started.current) {
        started.current = true;
        setPlayerOk(true);
        cmd("mute");
        cmd("seekTo", [tRef.current, true]);
        setTimeout(() => cmd("pauseVideo"), 500);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isYt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isYt || !playerOk) return;
    const id = setTimeout(() => {
      cmd("seekTo", [t, true]);
      cmd("playVideo");
      setTimeout(() => cmd("pauseVideo"), 450);
    }, 200);
    return () => clearTimeout(id);
  }, [t, playerOk, isYt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mux：每次換秒數重新取截圖（0.4 秒後）。
  useEffect(() => {
    if (isYt) return;
    let dead = false;
    setBusy(true);
    const id = setTimeout(async () => {
      try {
        const blob = await apiBlob(`/admin/lessons/${lesson.id}/mux-frame?time=${t}`);
        if (dead) return;
        setErr(null);
        setFrame((old) => (old && URL.revokeObjectURL(old), URL.createObjectURL(blob)));
      } catch (e) {
        if (!dead) setErr((e as Error).message);
      } finally {
        if (!dead) setBusy(false);
      }
    }, 400);
    return () => {
      dead = true;
      clearTimeout(id);
    };
  }, [t, isYt, lesson.id]);

  const use = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (isYt) onPicked(await captureIframe(iframe.current!));
      else if (frame) onPicked(await loadImageUrl(frame));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  tRef.current = t;
  const nudge = (d: number) => setT((v) => Math.min(hi, Math.max(lo, Math.round((v + d) * 10) / 10)));

  return (
    <BottomSheet onClose={() => !busy && onClose()}>
      <AppText variant="headline">{isYt ? "從 YouTube 影片選畫面" : "從 Mux 影片選畫面"}</AppText>
      <AppText variant="caption" tone="muted">
        {isYt ? "拖動時間軸找到想要的畫面，按「擷取這個畫面」。瀏覽器會跳出分享視窗，請選「這個分頁」並按分享（只有電腦版 Chrome／Edge 可用）。" : "拖動時間軸或輸入秒數，預覽就是影片那一秒的畫面。"}
      </AppText>
      {isYt ? (
        <iframe
          key={reload}
          ref={iframe}
          title="影片預覽"
          onLoad={() => {
            started.current = false;
            iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
          }}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.ref ?? "")}?controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&cc_load_policy=0&playsinline=1&autoplay=1&mute=1&enablejsapi=1&start=${Math.floor(lo)}&origin=${encodeURIComponent(location.origin)}`}
          style={{ width: "100%", maxWidth: 480, aspectRatio: "16 / 9", border: 0, borderRadius: 8, background: "#000" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : frame ? (
        <img src={frame} alt={`影片 ${mmss(t)} 的畫面`} style={{ width: "100%", maxWidth: 480, aspectRatio: "16 / 9", objectFit: "contain", background: "#000", borderRadius: 8 }} />
      ) : (
        <View style={{ width: "100%", maxWidth: 480, aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ color: "#fff" }}>{busy ? "取得畫面中…" : "—"}</AppText>
        </View>
      )}
      {isYt && !playerOk ? (
        <AppText variant="caption" tone="muted">
          播放器啟動中…如果超過 10 秒仍是黑畫面，請確認這支影片允許嵌入（YouTube 工作室 → 內容 → 影片 → 嵌入），或按「重新載入播放器」。也可以改用「上傳圖片」。
        </AppText>
      ) : null}
      <View style={styles.timeRow}>
        <AppText variant="callout" style={{ minWidth: 56, fontWeight: "700" }}>
          {mmss(t)}
        </AppText>
        <input type="range" min={lo} max={hi} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} style={{ flex: 1, height: 36 }} aria-label="影片時間" />
      </View>
      <View style={styles.buttons}>
        <Button variant="secondary" label="−10 秒" onPress={() => nudge(-10)} />
        <Button variant="secondary" label="−1 秒" onPress={() => nudge(-1)} />
        <Button variant="secondary" label="+1 秒" onPress={() => nudge(1)} />
        <Button variant="secondary" label="+10 秒" onPress={() => nudge(10)} />
      </View>
      {err ? (
        <AppText variant="caption" style={{ color: "#b3261e" }}>
          {err}
        </AppText>
      ) : null}
      <View style={styles.buttons}>
        {isYt ? <Button variant="secondary" label="重新載入播放器" icon="refresh-outline" onPress={() => (setPlayerOk(false), setReload((n) => n + 1))} /> : null}
        <Button variant="secondary" label="取消" disabled={busy && isYt} onPress={onClose} />
        <Button label={isYt ? "擷取這個畫面" : "使用這張畫面"} icon="camera-outline" loading={busy} disabled={busy || (!isYt && !frame)} onPress={use} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  thumbs: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  col: { gap: space.xs, alignItems: "flex-start" },
  cover: { width: 160, height: 90, borderRadius: radius.sm },
  poster: { width: 90, height: 120, borderRadius: radius.sm },
  empty: { backgroundColor: "#00000010", alignItems: "center", justifyContent: "center" },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  previews: { flexDirection: "row", gap: space.md, alignItems: "flex-end" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
