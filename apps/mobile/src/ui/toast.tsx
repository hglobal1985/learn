import { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { radius, space } from "@/theme/tokens";
import { AppText } from "./text";

let current: { id: number; text: string } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** 畫面下方短暫浮出一行提示（2.5 秒後自動消失）。例如：已複製連結。 */
export function showToast(text: string): void {
  const id = Date.now();
  current = { id, text };
  emit();
  setTimeout(() => {
    if (current?.id === id) {
      current = null;
      emit();
    }
  }, 2500);
}

/** 放在根版面一次即可。 */
export function ToastHost() {
  const t = useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => current,
    () => current,
  );
  const [, force] = useState(0);
  useEffect(() => force((n) => n + 1), [t?.id]);
  if (!t) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.box}>
        <AppText variant="callout" style={{ color: "#fff" }}>
          {t.text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 96, alignItems: "center", zIndex: 3000 },
  box: { backgroundColor: "rgba(20,28,24,0.92)", paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
});
