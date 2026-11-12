import { useCallback, useEffect, useRef, useState } from "react";
import { api, resolveUrl, type CourseDetail, type CoverBackground } from "@/api/client";
import { useSession } from "@/state/session";
import { AppText, Button, Card, NoticeBox, Section } from "@/ui";
import { EdmCropper } from "./edm-cropper.web";
import { BG_MAX_SIDE, COVER_H, COVER_W, EDM_MAX_SIDE, compress, composeCover, loadImage, loadImageUrl, type Rect } from "./image-tools";

type Job = { mode: "edm" | "cover"; img: HTMLImageElement; src: string; crop: Rect; noCrop: boolean; bgId: string | null };
const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const full = (img: HTMLImageElement): Rect => ({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
/** 直接上傳橫式封面時的預設裁切框：置中、盡量大的 16:9。 */
function wide(img: HTMLImageElement): Rect {
  const w = Math.min(img.naturalWidth, (img.naturalHeight * 16) / 9);
  const h = (w * 9) / 16;
  return { x: Math.round((img.naturalWidth - w) / 2), y: Math.round((img.naturalHeight - h) / 2), w: Math.round(w), h: Math.round(h) };
}

/**
 * 管理員（網頁版）：上傳課程海報 EDM 並自動作為封面；可自訂裁切、從底圖圖庫選底圖或自行上傳底圖；
 * 也可直接上傳橫式封面圖。圖片在瀏覽器內壓縮與合成，不保留原始檔案。
 */
export function CoverManager({ course, onChanged }: { course: CourseDetail; onChanged: () => void }) {
  const { member } = useSession();
  const isAdmin = member?.role === "admin";
  const [job, setJob] = useState<Job | null>(null);
  const [gallery, setGallery] = useState<CoverBackground[]>([]);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const edmInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const bgInput = useRef<HTMLInputElement | null>(null);

  const loadGallery = useCallback(async () => {
    const list = await api<CoverBackground[]>("GET", "/admin/cover-backgrounds");
    setGallery(list);
    return list;
  }, []);

  // 開啟編輯面板時才讀圖庫（上傳者姓名與中心只在這裡顯示）。
  useEffect(() => {
    if (job?.mode === "edm" && !gallery.length) {
      loadGallery()
        .then((l) => setJob((j) => (j && !j.bgId && l.length ? { ...j, bgId: l.find((g) => !g.hidden)?.id ?? null } : j)))
        .catch((e: Error) => setMsg({ tone: "danger", text: e.message }));
    }
  }, [job?.mode, gallery.length, loadGallery]);

  // 選到的底圖載入成圖片，供預覽與合成。
  const chosen = gallery.find((g) => g.id === job?.bgId) ?? null;
  useEffect(() => {
    setBgImg(null);
    if (job?.mode === "edm" && chosen) loadImageUrl(resolveUrl(chosen.url)).then(setBgImg).catch(() => setMsg({ tone: "danger", text: "底圖載入失敗" }));
  }, [chosen?.id, job?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 即時預覽（裁切或換底圖後 0.2 秒更新）。
  useEffect(() => {
    if (!job) return setPreview(null);
    if (job.mode === "edm" && !bgImg) return;
    let url: string | null = null;
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const blob = await composeCover(job.img, job.noCrop && job.mode === "edm" ? null : job.crop, job.mode === "edm" ? bgImg : null, 0.7);
        if (dead) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      } catch {
        /* 預覽失敗不影響儲存時的錯誤訊息 */
      }
    }, 200);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [job?.img, job?.crop, job?.noCrop, job?.mode, bgImg]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (mode: "edm" | "cover") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg({ tone: "info", text: "讀取圖片中…" });
    try {
      const img = await loadImage(file);
      setJob({ mode, img, src: img.src, crop: mode === "edm" ? full(img) : wide(img), noCrop: false, bgId: null });
      setMsg(null);
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const uploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg({ tone: "info", text: "壓縮並上傳底圖…" });
    try {
      const blob = await compress(await loadImage(file), BG_MAX_SIDE);
      const made = await api<CoverBackground>("PUT", "/admin/cover-backgrounds", blob);
      await loadGallery();
      setJob((j) => (j ? { ...j, bgId: made.id } : j));
      setMsg({ tone: "success", text: "底圖已上傳到圖庫，並已選用" });
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!job) return;
    setBusy(true);
    setMsg({ tone: "info", text: "處理並上傳中…" });
    try {
      if (job.mode === "edm") {
        if (!bgImg) throw Error("請先選擇底圖");
        const edm = await compress(job.img, EDM_MAX_SIDE, 0.9);
        const cover = await composeCover(job.img, job.noCrop ? null : job.crop, bgImg);
        await api("PUT", `/admin/courses/${course.id}/edm`, edm);
        await api("PUT", `/admin/courses/${course.id}/cover?bg=${encodeURIComponent(job.bgId ?? "")}`, cover);
      } else {
        await api("PUT", `/admin/courses/${course.id}/cover`, await composeCover(job.img, job.crop, null));
      }
      setJob(null);
      setMsg({ tone: "success", text: job.mode === "edm" ? "EDM 已上傳，並已設為封面" : "封面已更新" });
      onChanged();
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (part: "edm" | "cover") => {
    if (!window.confirm(part === "edm" ? "移除 EDM？（封面不受影響）" : "移除封面？（會改回色塊封面）")) return;
    setBusy(true);
    try {
      await api("DELETE", `/admin/courses/${course.id}/${part}`);
      setMsg({ tone: "success", text: "已移除" });
      onChanged();
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const galleryAct = async (g: CoverBackground, act: "hide" | "show" | "delete") => {
    setBusy(true);
    try {
      if (act === "delete") {
        if (!window.confirm("刪除這張底圖？")) return;
        await api("DELETE", `/admin/cover-backgrounds/${g.id}`);
        setJob((j) => (j?.bgId === g.id ? { ...j, bgId: null } : j));
      } else await api("PATCH", `/admin/cover-backgrounds/${g.id}`, { hidden: act === "hide" });
      await loadGallery();
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const hiddenInput = (ref: React.RefObject<HTMLInputElement | null>, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void) => (
    <input ref={ref} type="file" accept={FILE_ACCEPT} onChange={onChange} style={{ display: "none" }} />
  );

  return (
    <Section title="海報（EDM）與封面">
      <Card>
        <AppText tone="muted" variant="callout">
          上傳直式 EDM 會自動合成為橫式（16:9）封面，可自訂裁切與底圖。圖片可選 JPG、PNG、WebP、HEIC（單張 20MB 內），上傳時自動壓縮：EDM 長邊 {EDM_MAX_SIDE}px、封面與底圖長邊 {BG_MAX_SIDE}px，不保留原始檔案。
        </AppText>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 220px" }}>
            <AppText variant="callout" tone="muted">
              目前封面
            </AppText>
            {course.coverUrl ? <img src={resolveUrl(course.coverUrl)} alt="目前封面" style={{ width: "100%", maxWidth: 320, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 8, display: "block" }} /> : <AppText>（未設定，使用色塊封面）</AppText>}
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <AppText variant="callout" tone="muted">
              目前 EDM
            </AppText>
            {course.edmUrl ? <img src={resolveUrl(course.edmUrl)} alt="目前 EDM" style={{ width: "100%", maxWidth: 140, borderRadius: 6, display: "block" }} /> : <AppText>（未上傳）</AppText>}
          </div>
        </div>
        {hiddenInput(edmInput, pick("edm"))}
        {hiddenInput(coverInput, pick("cover"))}
        {hiddenInput(bgInput, uploadBg)}
        {!job ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button label={course.edmUrl ? "更換 EDM（自動作為封面）" : "上傳 EDM（自動作為封面）"} icon="image-outline" disabled={busy} onPress={() => edmInput.current?.click()} />
            <Button variant="secondary" label="直接上傳橫式封面圖" icon="crop-outline" disabled={busy} onPress={() => coverInput.current?.click()} />
            {course.edmUrl ? <Button variant="ghost" label="移除 EDM" disabled={busy} onPress={() => remove("edm")} /> : null}
            {course.coverUrl ? <Button variant="ghost" label="移除封面" disabled={busy} onPress={() => remove("cover")} /> : null}
          </div>
        ) : null}
      </Card>

      {job ? (
        <Card>
          <AppText variant="headline">{job.mode === "edm" ? "裁切與選擇底圖" : "裁切橫式封面（固定 16:9）"}</AppText>
          {job.mode === "edm" ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={job.noCrop} onChange={(e) => setJob({ ...job, noCrop: e.target.checked })} />
              <span>不裁切（整張 EDM 放進封面）</span>
            </label>
          ) : null}
          {!(job.mode === "edm" && job.noCrop) ? (
            <>
              <AppText variant="callout" tone="muted">
                拖曳框內移動位置，拖四個角調整大小。
              </AppText>
              <EdmCropper src={job.src} imgW={job.img.naturalWidth} imgH={job.img.naturalHeight} aspect={job.mode === "cover" ? 16 / 9 : null} value={job.crop} onChange={(crop) => setJob({ ...job, crop })} />
            </>
          ) : null}
          <AppText variant="callout" tone="muted">
            封面預覽（{COVER_W}×{COVER_H}）
          </AppText>
          {preview ? <img src={preview} alt="封面預覽" style={{ width: "100%", maxWidth: 480, aspectRatio: "16 / 9", borderRadius: 8, display: "block" }} /> : <AppText>產生預覽中…</AppText>}

          {job.mode === "edm" ? (
            <>
              <AppText variant="headline">封面底圖</AppText>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                {gallery.map((g) => (
                  <div key={g.id} style={{ border: g.id === job.bgId ? "3px solid #2F5D3A" : "1px solid #ccc", borderRadius: 8, padding: 6, opacity: g.hidden ? 0.5 : 1 }}>
                    <img src={resolveUrl(g.url)} alt="底圖" onClick={() => !g.hidden && setJob({ ...job, bgId: g.id })} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 4, cursor: g.hidden ? "default" : "pointer", display: "block" }} />
                    <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
                      {g.builtin ? g.uploaderName : `${g.uploaderName}${g.uploaderCenter ? `・${g.uploaderCenter}` : ""}`}
                      {g.hidden ? "（已隱藏）" : ""}
                    </div>
                    {isAdmin ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        <button type="button" disabled={busy} onClick={() => galleryAct(g, g.hidden ? "show" : "hide")} style={{ fontSize: 12 }}>
                          {g.hidden ? "取消隱藏" : "隱藏"}
                        </button>
                        {!g.builtin ? (
                          <button type="button" disabled={busy || g.inUse} title={g.inUse ? "使用中，只能隱藏" : ""} onClick={() => galleryAct(g, "delete")} style={{ fontSize: 12 }}>
                            刪除
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <Button variant="secondary" label="上傳自訂底圖（加入圖庫）" icon="add-circle-outline" disabled={busy} onPress={() => bgInput.current?.click()} />
              <AppText variant="caption" tone="muted">
                自訂底圖會加入圖庫（顯示上傳者與中心，僅有課程編輯權限的人看得到），上傳時自動壓縮到長邊 {BG_MAX_SIDE}px。
              </AppText>
            </>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button label="儲存" icon="save-outline" loading={busy} disabled={busy || (job.mode === "edm" && !bgImg)} onPress={save} />
            <Button variant="ghost" label="取消" disabled={busy} onPress={() => (setJob(null), setMsg(null))} />
          </div>
        </Card>
      ) : null}
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
    </Section>
  );
}
