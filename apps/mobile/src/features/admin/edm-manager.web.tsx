import { useEffect, useRef, useState } from "react";
import { api, resolveUrl, type CourseDetail } from "@/api/client";
import { confirmAsk } from "@/features/confirm";
import { AppText, Button, Card, NoticeBox, Section } from "@/ui";
import { EdmCropper } from "./edm-cropper.web";
import { EDM_MAX_SIDE, COVER_MAX_SIDE, cropCompress, loadImage, loadImageUrl, type Rect } from "./image-tools";
import { ViewWindowPicker } from "./view-window-picker.web";

type Job = { img: HTMLImageElement; src: string; isNew: boolean; viewY: number; cover: Rect; withCover: boolean };
const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/** 預設的 16:9 封面裁切框：置中偏上、盡量大。 */
function defaultCover(img: HTMLImageElement): Rect {
  const w = Math.min(img.naturalWidth, (img.naturalHeight * 16) / 9);
  const h = (w * 9) / 16;
  return { x: Math.round((img.naturalWidth - w) / 2), y: 0, w: Math.round(w), h: Math.round(h) };
}

/**
 * 管理員（網頁版）：上傳課程海報 EDM，並設定兩件事——
 * ①「EDM 預設位置」：課程介紹頁上方一進來停在 EDM 的哪個位置（上下拖曳取景框）；
 * ②「裁切封面」：從 EDM 裁出固定 16:9 的橫式封面，當課程清單的縮圖。
 * 圖片在瀏覽器內壓縮，不保留原始檔案。
 */
export function EdmManager({ course, onChanged }: { course: CourseDetail; onChanged: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  // 封面預覽（裁切後 0.2 秒更新）。
  useEffect(() => {
    if (!job || !job.withCover) return setPreview(null);
    let url: string | null = null;
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const blob = await cropCompress(job.img, job.cover, 640, 0.75);
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
  }, [job?.img, job?.cover, job?.withCover]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg({ tone: "info", text: "讀取圖片中…" });
    try {
      const img = await loadImage(file);
      setJob({ img, src: img.src, isNew: true, viewY: 0, cover: defaultCover(img), withCover: true });
      setMsg(null);
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  /** 不換圖，只重新調整目前 EDM 的預設位置與封面。 */
  const adjust = async () => {
    if (!course.edmUrl) return;
    setBusy(true);
    setMsg({ tone: "info", text: "讀取 EDM 中…" });
    try {
      const img = await loadImageUrl(resolveUrl(course.edmUrl));
      setJob({ img, src: img.src, isNew: false, viewY: course.edmViewY, cover: defaultCover(img), withCover: !course.coverUrl });
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
      if (job.isNew) await api("PUT", `/admin/courses/${course.id}/edm`, await cropCompress(job.img, null, EDM_MAX_SIDE, 0.9));
      await api("PATCH", `/admin/courses/${course.id}`, { edmViewY: Math.round(job.viewY * 10000) / 10000 });
      if (job.withCover) await api("PUT", `/admin/courses/${course.id}/cover`, await cropCompress(job.img, job.cover, COVER_MAX_SIDE, 0.88));
      setJob(null);
      setMsg({ tone: "success", text: "已儲存" });
      onChanged();
    } catch (err) {
      setMsg({ tone: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (part: "edm" | "cover") => {
    if (!(await confirmAsk(part === "edm" ? "移除 EDM" : "移除封面", part === "edm" ? "移除後，課程介紹頁上方會改回色塊。" : "移除後，課程清單會改回色塊縮圖。", "確定移除"))) return;
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

  return (
    <Section title="課程海報（EDM）與封面">
      <Card>
        <AppText tone="muted" variant="callout">
          上傳課程海報（EDM）後，可以設定「預設停留位置」（課程介紹頁一進來看到哪一段，學員仍可上下拖曳看全部），並從 EDM 裁切一張橫式 16:9「封面」當課程清單的縮圖。可選 JPG、PNG、WebP、HEIC（單張 20MB 內），上傳時自動壓縮，不保留原始檔案。
        </AppText>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <AppText variant="callout" tone="muted">
              目前 EDM
            </AppText>
            {course.edmUrl ? <img src={resolveUrl(course.edmUrl)} alt="目前 EDM" style={{ width: 140, borderRadius: 6, display: "block" }} /> : <AppText>（尚未上傳）</AppText>}
          </div>
          <div>
            <AppText variant="callout" tone="muted">
              目前封面（課程清單縮圖）
            </AppText>
            {course.coverUrl ? <img src={resolveUrl(course.coverUrl)} alt="目前封面" style={{ width: 240, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 6, display: "block" }} /> : <AppText>（尚未設定，清單用色塊）</AppText>}
          </div>
        </div>
        <input ref={input} type="file" accept={FILE_ACCEPT} onChange={pick} style={{ display: "none" }} />
        {!job ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button label={course.edmUrl ? "更換 EDM" : "上傳 EDM"} icon="image-outline" disabled={busy} onPress={() => input.current?.click()} />
            {course.edmUrl ? <Button variant="secondary" label="調整預設位置與封面" icon="crop-outline" disabled={busy} onPress={adjust} /> : null}
            {course.edmUrl ? <Button variant="ghost" label="移除 EDM" disabled={busy} onPress={() => remove("edm")} /> : null}
            {course.coverUrl ? <Button variant="ghost" label="移除封面" disabled={busy} onPress={() => remove("cover")} /> : null}
          </div>
        ) : null}
      </Card>

      {job ? (
        <>
          <Card>
            <AppText variant="headline">① EDM 預設停留位置</AppText>
            <AppText variant="callout" tone="muted">
              上下拖曳金色框：框內就是學員一進課程介紹頁看到的範圍（寬度會自動符合畫面）。
            </AppText>
            <ViewWindowPicker src={job.src} imgW={job.img.naturalWidth} imgH={job.img.naturalHeight} value={job.viewY} onChange={(viewY) => setJob({ ...job, viewY })} />
          </Card>
          <Card>
            <AppText variant="headline">② 裁切封面（橫式 16:9，比例固定）</AppText>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={job.withCover} onChange={(e) => setJob({ ...job, withCover: e.target.checked })} />
              <span>{job.isNew ? "同時更新封面" : "重新裁切封面"}</span>
            </label>
            {job.withCover ? (
              <>
                <AppText variant="callout" tone="muted">
                  拖曳框內移動位置，拖四個角調整大小。
                </AppText>
                <EdmCropper src={job.src} imgW={job.img.naturalWidth} imgH={job.img.naturalHeight} aspect={16 / 9} value={job.cover} onChange={(cover) => setJob({ ...job, cover })} />
                <AppText variant="callout" tone="muted">
                  封面預覽
                </AppText>
                {preview ? <img src={preview} alt="封面預覽" style={{ width: "100%", maxWidth: 320, aspectRatio: "16 / 9", borderRadius: 8, display: "block" }} /> : <AppText>產生預覽中…</AppText>}
              </>
            ) : null}
          </Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button label="儲存" icon="save-outline" loading={busy} disabled={busy} onPress={save} />
            <Button variant="ghost" label="取消" disabled={busy} onPress={() => (setJob(null), setMsg(null))} />
          </div>
        </>
      ) : null}
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
    </Section>
  );
}
