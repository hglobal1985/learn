import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveUrl, type CourseSummary } from "@/api/client";
import { downloadImage, shareLink } from "@/lib/share";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, CourseCover, ShareIcon, StageFrame } from "@/ui";

/**
 * 課程介紹頁上方的 EDM：圖片寬度自動符合畫面最大寬度，只能上下拖曳（滑鼠或手指，禁止左右），
 * 一進來停在管理員設定的預設位置（edmViewY）；點一下彈出小視窗可放大縮小、下載、分享。
 * 沒有 EDM 時顯示色塊。外框用 StageFrame，高度與上課頁的影片區完全相同。
 */
export function EdmStage({ course }: { course: CourseSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <StageFrame>
      {course.edmUrl ? <EdmPan uri={resolveUrl(course.edmUrl)} viewY={course.edmViewY} onOpen={() => setOpen(true)} /> : <CourseCover theme={course.theme} label={course.category} fill />}
      {course.edmUrl && open ? <EdmLightbox uri={course.edmUrl} title={course.title} onClose={() => setOpen(false)} /> : null}
    </StageFrame>
  );
}

function EdmPan({ uri, viewY, onOpen }: { uri: string; viewY: number; onOpen: () => void }) {
  const { c } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState<number | null>(null); // 寬 / 高
  const ty = useRef(new Animated.Value(0)).current;
  const cur = useRef(0);
  const maxUp = useRef(0);
  const startY = useRef(0);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => alive && h && setRatio(w / h), () => undefined);
    return () => {
      alive = false;
    };
  }, [uri]);

  const imgH = ratio && box.w ? box.w / ratio : 0;
  maxUp.current = Math.max(0, imgH - box.h);
  const set = (v: number) => {
    cur.current = Math.min(0, Math.max(-maxUp.current, v));
    ty.setValue(cur.current);
  };
  // 一進來停在管理員指定的預設位置。
  useEffect(() => {
    if (imgH && box.h) set(-viewY * imgH);
  }, [imgH, box.h, viewY]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startY.current = cur.current;
      },
      onPanResponderMove: (_e, g) => set(startY.current + g.dy), // 只看上下，左右拖曳完全忽略
      onPanResponderRelease: (_e, g) => {
        if (Math.hypot(g.dx, g.dy) < 6) openRef.current(); // 點一下＝放大
      },
    }),
  ).current;
  const wheel = Platform.OS === "web" ? { onWheel: (e: { deltaY: number; preventDefault?: () => void }) => set(cur.current - e.deltaY) } : {};

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...pan.panHandlers} {...wheel} accessibilityRole="imagebutton" accessibilityLabel="課程海報，點一下放大，上下拖曳查看">
      {imgH ? <Animated.Image source={{ uri }} resizeMode="stretch" style={{ width: box.w, height: imgH, transform: [{ translateY: ty }] }} accessibilityIgnoresInvertColors /> : null}
      {maxUp.current > 8 ? (
        <View style={[styles.hint, { backgroundColor: "rgba(0,0,0,0.55)" }]} pointerEvents="none">
          <Ionicons name="swap-vertical" size={14} color="#fff" />
          <AppText variant="caption" style={{ color: "#fff" }}>
            上下拖曳 · 點一下放大
          </AppText>
        </View>
      ) : null}
      {!imgH ? <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceMuted }]} /> : null}
    </View>
  );
}

/** 站內小視窗：可放大縮小 EDM，有下載與分享（分享一律叫出系統的分享選單、使用系統預設分享圖示）。 */
function EdmLightbox({ uri, title, onClose }: { uri: string; title: string; onClose: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [scale, setScale] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const cardW = Math.min(win.width - 24, 560);
  const cardH = Math.min(win.height - insets.top - insets.bottom - 48, 760);
  const full = resolveUrl(uri);
  const [ratio, setRatio] = useState(0.7);
  useEffect(() => {
    Image.getSize(full, (w, h) => h && setRatio(w / h), () => undefined);
  }, [full]);
  const imgW = (cardW - 24) * scale;
  const zoom = (d: number) => setScale((s) => Math.min(4, Math.max(1, Math.round((s + d) * 10) / 10)));
  const act = useMemo(
    () => ({
      share: async () => {
        const r = await shareLink(title, uri);
        if (r === "copied") setMsg("已複製連結");
      },
      download: async () => {
        try {
          await downloadImage(uri, `${title}.jpg`);
        } catch {
          setMsg("下載失敗，請稍後再試");
        }
      },
    }),
    [title, uri],
  );
  const btn = (name: React.ComponentProps<typeof Ionicons>["name"], label: string, onPress: () => void, disabled?: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={[styles.tool, { backgroundColor: c.surface, borderColor: c.border, opacity: disabled ? 0.4 : 1 }]}>
      <Ionicons name={name} size={22} color={c.text} />
    </Pressable>
  );
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="關閉" />
        <View style={[styles.card, { width: cardW, height: cardH, backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.bar}>
            <AppText variant="headline" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="關閉" onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={26} color={c.text} />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: c.surfaceMuted, borderRadius: radius.sm }} contentContainerStyle={{ alignItems: "center" }} maximumZoomScale={4} minimumZoomScale={1}>
            <ScrollView horizontal contentContainerStyle={{ minWidth: cardW - 24, justifyContent: "center" }} showsHorizontalScrollIndicator={scale > 1}>
              <Image source={{ uri: full }} resizeMode="stretch" style={{ width: imgW, height: imgW / ratio }} accessibilityIgnoresInvertColors />
            </ScrollView>
          </ScrollView>
          {msg ? <AppText variant="caption" tone="muted" style={{ textAlign: "center" }}>{msg}</AppText> : null}
          <View style={styles.tools}>
            {btn("remove", "縮小", () => zoom(-0.5), scale <= 1)}
            <AppText variant="callout" tone="muted" style={{ minWidth: 48, textAlign: "center" }}>
              {Math.round(scale * 100)}%
            </AppText>
            {btn("add", "放大", () => zoom(0.5), scale >= 4)}
            <View style={{ flex: 1 }} />
            {btn("download-outline", "下載", act.download)}
            <Pressable accessibilityRole="button" accessibilityLabel="分享" onPress={act.share} style={[styles.tool, { backgroundColor: c.surface, borderColor: c.border }]}>
              <ShareIcon size={22} color={c.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hint: { position: "absolute", bottom: 8, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.sm, gap: space.sm },
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm },
  close: { width: minTouch, height: minTouch, alignItems: "center", justifyContent: "center" },
  tools: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tool: { width: minTouch, height: minTouch, borderRadius: minTouch / 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
