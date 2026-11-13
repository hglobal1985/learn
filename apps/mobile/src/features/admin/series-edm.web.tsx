import { useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { api, resolveUrl } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { radius, space } from "@/theme/tokens";
import { AppText, Button } from "@/ui";
import { EDM_MAX_SIDE, cropCompress, loadImage } from "./image-tools";

const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/**
 * 系列專屬 EDM（網頁版）：顯示縮圖、上傳／更換、移除。圖片在瀏覽器內壓縮；
 * 沒有上傳時，「全部課程」會用系列名稱當大標題。
 */
export function SeriesEdm({ series, edmUrl, onChanged }: { series: string; edmUrl?: string | null; onChanged: () => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const q = `?series=${encodeURIComponent(series)}`;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg("上傳中…");
    try {
      const img = await loadImage(file);
      await api("PUT", `/admin/series/edm${q}`, await cropCompress(img, null, EDM_MAX_SIDE, 0.9));
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
      <input ref={input} type="file" accept={FILE_ACCEPT} onChange={pick} style={{ display: "none" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: "flex-start" },
  thumb: { width: 96, height: 128, borderRadius: radius.sm },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
