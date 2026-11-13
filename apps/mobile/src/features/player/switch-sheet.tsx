import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button } from "@/ui";
import { SWITCH_COUNTDOWN_SECONDS, switchPromptStore, type SwitchPrompt } from "./switch-prompt";

/**
 * 底部彈出面板：已有課程正在播放時，又要播另一堂，詢問要不要中斷。
 * 15 秒內沒有操作，視同同意，自動改播新的這一堂。放在根版面，網頁與手機 App 共用。
 */
export function SwitchSheet() {
  const prompt = useSyncExternalStore(switchPromptStore.subscribe, switchPromptStore.get, switchPromptStore.get);
  if (!prompt) return null;
  return <Sheet key={prompt.to.key + prompt.from.key} prompt={prompt} />;
}

function Sheet({ prompt }: { prompt: SwitchPrompt }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [left, setLeft] = useState(SWITCH_COUNTDOWN_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0) prompt.resolve(true); // 倒數結束沒有操作＝同意改播
  }, [left, prompt]);

  return (
    <Modal transparent animationType="slide" onRequestClose={() => prompt.resolve(false)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="關閉" onPress={() => prompt.resolve(false)} />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: space.lg + insets.bottom }]} accessibilityViewIsModal>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <AppText variant="title">要改播這一堂嗎？</AppText>
          <View style={[styles.row, { backgroundColor: c.background, borderColor: c.accent }]}>
            <Ionicons name="play-circle" size={24} color={c.accent} />
            <AppText variant="headline" numberOfLines={2} style={styles.text}>
              {prompt.to.title}
            </AppText>
          </View>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            正在播放：{prompt.from.title}
          </AppText>
          <View style={[styles.bar, { backgroundColor: c.border }]}>
            <View style={{ height: 4, width: `${Math.max(0, left) * (100 / SWITCH_COUNTDOWN_SECONDS)}%`, backgroundColor: c.accent, borderRadius: 2 }} />
          </View>
          <View style={styles.buttons}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label="關閉" fullWidth onPress={() => prompt.resolve(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={`確定播放（${Math.max(0, left)}）`} fullWidth onPress={() => prompt.resolve(true)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.md },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderRadius: radius.md, padding: space.md, minHeight: minTouch },
  text: { flex: 1, gap: 2 },
  bar: { height: 4, borderRadius: 2, overflow: "hidden" },
  buttons: { flexDirection: "row", gap: space.sm },
});
