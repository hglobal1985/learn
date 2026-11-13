import { useEffect, useRef, useState } from "react";
import { api, resolveUrl, type CourseDetail } from "@/api/client";
import { AppText, Button, Card, NoticeBox, Section } from "@/ui";
import { EdmCropper } from "./edm-cropper.web";
import { EDM_MAX_SIDE, cropCompress, loadImage, type Rect } from "./image-tools";

type Job = { img: HTMLImageElement; src: string; crop: Rect; noCrop: boolean };
const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const full = (img: HTMLImageElement): Rect => ({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });

/**
 * 管理員（網頁版）：上傳課程海報 EDM，可自訂裁切。課程橫幅不用另外上傳，
 * 系統會自動把這張 EDM 模糊並放大成橫幅底圖。圖片在瀏覽器內壓縮，不保留原始檔案。
 */
export function EdmManager({ course, onChanged }: { course: CourseDetail; onChanged: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  // 即時預覽裁切結果（0.2 秒後更新）。
  useEffect(() => {
    if (!job) return setPreview(null);
    let url: string | null = null;
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const blob = await cropCompress(job.img, job.noCrop ? null : job.crop, 600, 0.7);
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
  }, [job?.img, job?.crop, job?.noCrop]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg({ tone: "info", text: "讀取圖片中…" });
    try {
      const img = await loadImage(file);
      setJob({ img, src: img.src, crop: full(img), noCrop: true });
      setMsg(null);
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
      await api("PUT", `/admin/courses/${course.id}/edm`, await cropCompress(job.img, job.noCrop ? null : job.crop, EDM_MAX_SIDE, 0.9));
      setJob(null);
      setMsg({ tone: "success", text: "EDM 已上傳，課程橫幅會自動套用" });
      onChanged();
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("移除 EDM？（橫幅會改回色塊）")) return;
    setBusy(true);
    try {
      await api("DELETE", `/admin/courses/${course.id}/edm`);
      setMsg({ tone: "success", text: "已移除" });
      onChanged();
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="課程海報（EDM）">
      <Card>
        <AppText tone="muted" variant="callout">
          上傳課程海報（EDM）。課程橫幅會自動把 EDM 模糊放大當底圖，不需要另外做封面。可選 JPG、PNG、WebP、HEIC（單張 20MB 內），上傳時自動壓縮到長邊 {EDM_MAX_SIDE}px，不保留原始檔案。
        </AppText>
        {course.edmUrl ? <img src={resolveUrl(course.edmUrl)} alt="目前 EDM" style={{ width: "100%", maxWidth: 180, borderRadius: 6, display: "block" }} /> : <AppText>（尚未上傳）</AppText>}
        <input ref={input} type="file" accept={FILE_ACCEPT} onChange={pick} style={{ display: "none" }} />
        {!job ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button label={course.edmUrl ? "更換 EDM" : "上傳 EDM"} icon="image-outline" disabled={busy} onPress={() => input.current?.click()} />
            {course.edmUrl ? <Button variant="ghost" label="移除 EDM" disabled={busy} onPress={remove} /> : null}
          </div>
        ) : null}
      </Card>

      {job ? (
        <Card>
          <AppText variant="headline">裁切 EDM（選填）</AppText>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={job.noCrop} onChange={(e) => setJob({ ...job, noCrop: e.target.checked })} />
            <span>不裁切（使用整張圖）</span>
          </label>
          {!job.noCrop ? (
            <>
              <AppText variant="callout" tone="muted">
                拖曳框內移動位置，拖四個角調整大小。
              </AppText>
              <EdmCropper src={job.src} imgW={job.img.naturalWidth} imgH={job.img.naturalHeight} aspect={null} value={job.crop} onChange={(crop) => setJob({ ...job, crop })} />
            </>
          ) : null}
          <AppText variant="callout" tone="muted">
            預覽
          </AppText>
          {preview ? <img src={preview} alt="EDM 預覽" style={{ width: "100%", maxWidth: 240, borderRadius: 8, display: "block" }} /> : <AppText>產生預覽中…</AppText>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button label="儲存" icon="save-outline" loading={busy} disabled={busy} onPress={save} />
            <Button variant="ghost" label="取消" disabled={busy} onPress={() => (setJob(null), setMsg(null))} />
          </div>
        </Card>
      ) : null}
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
    </Section>
  );
}
