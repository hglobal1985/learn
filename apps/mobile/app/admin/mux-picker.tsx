import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, RequestError, type MuxAsset, type MuxAssetPage } from "@/api/client";
import { dateTime } from "@/features/format";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, Icon, LoadingView, NoticeBox, Pill, Screen } from "@/ui";

const duration = (s: number | null) => {
  if (s == null) return "";
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** 管理員：從 Mux 帳號中挑選影片，點一下就帶入該堂課（Playback ID 與影片長度）。 */
export default function MuxPickerScreen() {
  const { lessonId, lessonTitle } = useLocalSearchParams<{ lessonId: string; lessonTitle?: string }>();
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const [assets, setAssets] = useState<MuxAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async (next?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await api<MuxAssetPage>("GET", `/admin/mux/assets${next ? `?cursor=${encodeURIComponent(next)}` : ""}`);
      setAssets((prev) => (next ? [...prev, ...page.assets] : page.assets));
      setCursor(page.nextCursor);
    } catch (e) {
      setError({ code: e instanceof RequestError ? e.code : "error", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (member?.role === "admin") load();
  }, [load, member?.role]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? assets.filter((a) => a.title.toLowerCase().includes(q) || a.assetId.toLowerCase().includes(q)) : assets;
  }, [assets, query]);

  const pick = async (a: MuxAsset) => {
    if (!a.signedPlaybackId) return;
    setSaving(a.assetId);
    setError(null);
    try {
      await api("PATCH", `/admin/lessons/${lessonId}`, {
        mediaType: "mux",
        mediaRef: a.signedPlaybackId,
        ...(a.durationSeconds ? { minutes: Math.max(1, Math.ceil(a.durationSeconds / 60)) } : {}),
      });
      invalidate();
      router.back();
    } catch (e) {
      setError({ code: "save", message: (e as Error).message });
      setSaving(null);
    }
  };

  if (member?.role !== "admin") return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: lessonTitle ? `選擇影片：${lessonTitle}` : "從 Mux 選擇影片" }} />
      {error?.code === "mux_api_not_configured" || error?.code === "mux_api_unauthorized" ? (
        <EmptyState
          icon="key-outline"
          title={error.code === "mux_api_not_configured" ? "尚未連結 Mux 帳號" : "Mux 存取權杖無效"}
          body="請在 Cloudflare 的 Worker「learn」設定 MUX_TOKEN_ID（一般變數）與 MUX_TOKEN_SECRET（Secret），權杖只需要 Mux Video 的讀取權限。"
        />
      ) : null}
      {error && error.code !== "mux_api_not_configured" && error.code !== "mux_api_unauthorized" ? <NoticeBox tone="danger" text={error.message} /> : null}
      {assets.length ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋影片名稱"
          placeholderTextColor={c.textMuted}
          accessibilityLabel="搜尋影片名稱"
          style={[styles.search, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
        />
      ) : null}
      {shown.map((a) => {
        const usable = !!a.signedPlaybackId && a.status === "ready";
        return (
          <Pressable
            key={a.assetId}
            disabled={!usable || !!saving}
            onPress={() => pick(a)}
            accessibilityRole="button"
            accessibilityLabel={`匯入 ${a.title || a.assetId}`}
            style={({ pressed }) => [pressed && { opacity: 0.8 }, !usable && { opacity: 0.55 }]}
          >
            <Card style={styles.row}>
              <View style={[styles.thumb, { backgroundColor: c.surfaceMuted }]}>
                {a.thumbnailUrl ? <Image source={{ uri: a.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Icon name="videocam-outline" color={c.textMuted} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="headline" numberOfLines={2}>
                  {a.title || "未命名影片"}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {[duration(a.durationSeconds), a.createdAt ? dateTime(a.createdAt) : ""].filter(Boolean).join(" · ")}
                </AppText>
                {a.status !== "ready" ? <Pill label="處理中" tone="warning" /> : !a.signedPlaybackId ? <Pill label="公開影片，請先在 Mux 加上 Signed 播放 ID" tone="warning" /> : null}
              </View>
              {saving === a.assetId ? <AppText tone="muted">匯入中…</AppText> : usable ? <Icon name="add-circle-outline" color={c.accentText} size={24} /> : null}
            </Card>
          </Pressable>
        );
      })}
      {loading ? <LoadingView /> : null}
      {!loading && !error && !assets.length ? <EmptyState icon="videocam-outline" title="Mux 帳號裡還沒有影片" /> : null}
      {!loading && assets.length && !shown.length ? <EmptyState icon="search-outline" title="找不到符合的影片" /> : null}
      {!loading && cursor ? <Button variant="secondary" label="載入更多" onPress={() => load(cursor)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  thumb: { width: 112, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  search: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
});
