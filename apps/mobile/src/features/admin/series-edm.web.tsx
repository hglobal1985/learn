import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { api, resolveUrl } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { radius, space } from "@/theme/tokens";
import { AppText, Button } from "@/ui";
import { BottomSheet } from "@/ui/bottom-sheet";
import { EdmCropper } from "./edm-cropper.web";
import { COVER_MAX_SIDE, cropCompress, loadImage, type Rect } from "./image-tools";

/** 預設的 16:9 裁切框：置中偏上、盡量大。 */
function defaultCrop(img: HTMLImageElement): Rect {
  const w = Math.min(img.naturalWidth, (img.naturalHeight * 16) / 9);
  const h = (w * 9) / 16;
  return { x: Math.round((img.naturalWidth - w) / 2), y: 0, w: Math.round(w), h: Math.round(h) };
}

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/**
 * 系列專屬 EDM（網頁版）：顯示縮圖、上傳／更換、移除。圖片在瀏覽器內壓縮；
 * 沒有上傳時，「全部課程」會用系列名稱當大標題。
 */
export function SeriesEdm({ series, edmUrl, onChanged }: { series: string; edmUrl?: string | null; onChanged: () => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [job, setJob] = useState<{ img: HTMLImageElement; crop: Rect } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const q = `?series=${encodeURIComponent(series)}`;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg("讀取圖片中…");
    try {
      const img = await loadImage(file);
      setJob({ img, crop: defaultCrop(img) });
      setMsg(null);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // 裁切後的預覽（0.2 秒更新）。
  useEffect(() => {
    if (!job) return setPreview(null);
    let dead = false;
    let url: string | null = null;
    const t = setTimeout(async () => {
      try {
        const blob = await cropCompress(job.img, job.crop, 640, 0.75);
        if (dead) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      } catch {
        /* 預覽失敗不影響儲存 */
      }
    }, 200);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [job?.img, job?.crop]); // eslint-disable-line react-hooks/exhaustive-deps
  /** 只上傳裁好的 16:9 橫式圖，不保留原始檔。 */
  const save = async () => {
    if (!job) return;
    setBusy(true);
    setMsg("上傳中…");
    try {
      await api("PUT", `/admin/series/edm${q}`, await cropCompress(job.img, job.crop, COVER_MAX_SIDE, 0.9));
      setJob(null);
      setMsg(null);
      onChanged();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await confirmSheet({ title: "移除系列 EDM", message: `移除「${series}」的專屬 EDM 後，「全部課程」會改用系列名稱當大標題。`, confirmLabel: "移除", cancelLabel: "先不要", danger: true }))) return;
    setBusy(true);
    try {
      await api("DELETE", `/admin/series/edm${q}`);
      onChanged();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {edmUrl ? <Image source={{ uri: resolveUrl(edmUrl) }} style={styles.thumb} resizeMode="cover" accessibilityLabel={`${series} EDM`} /> : null}
      <View style={styles.buttons}>
        <Button variant="secondary" label={edmUrl ? "更換 EDM" : "上傳 EDM"} icon="image-outline" loading={busy} disabled={busy} onPress={() => input.current?.click()} />
        {edmUrl ? <Button variant="ghost" label="移除 EDM" disabled={busy} onPress={remove} /> : null}
      </View>
      {!edmUrl ? (
        <AppText variant="caption" tone="muted">
          還沒有 EDM：全部課程用系列名稱當大標題
        </AppText>
      ) : null}
      {msg ? (
        <AppText variant="caption" style={{ color: "#b3261e" }}>
          {msg}
        </AppText>
      ) : null}
      {job ? (
        <BottomSheet onClose={() => !busy && setJob(null)}>
          <AppText variant="headline">裁切「{series}」的 EDM</AppText>
          <AppText variant="caption" tone="muted">
            系列 EDM 固定顯示橫式 16:9，只會保存框起來的部分（不保留原圖）。拖曳框內移動位置，拖四個角調整大小。
          </AppText>
          <View style={{ maxHeight: 420, overflow: "scroll" as never }}>
            <EdmCropper src={job.img.src} imgW={job.img.naturalWidth} imgH={job.img.naturalHeight} aspect={16 / 9} value={job.crop} onChange={(crop) => setJob({ ...job, crop })} />
          </View>
          <AppText variant="callout" tone="muted">
            預覽（16:9）
          </AppText>
          {preview ? <img src={preview} alt="預覽" style={{ width: "100%", maxWidth: 320, aspectRatio: "16 / 9", borderRadius: 8, display: "block" }} /> : <AppText>產生預覽中…</AppText>}
          <View style={styles.buttons}>
            <Button variant="secondary" label="取消" disabled={busy} onPress={() => setJob(null)} />
            <Button label="儲存" icon="checkmark-outline" loading={busy} disabled={busy} onPress={save} />
          </View>
        </BottomSheet>
      ) : null}
      <input ref={input} type="file" accept={FILE_ACCEPT} onChange={pick} style={{ display: "none" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: "flex-start" },
  thumb: { width: 160, height: 90, borderRadius: radius.sm },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
