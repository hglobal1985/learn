import { StyleSheet, View } from "react-native";
import { AppText } from "./text";

/**
 * 卡片角落的斜緞帶（不擋點擊）。side：left＝左上角（資格或狀態）、right＝右上角（日期倒數）。
 * 顏色與文字由「課程排序與條件」設定決定（色碼只能用寰宇生態系規範色）。
 * scale：整體縮放（小卡片用 0.8 左右），預設 1。
 */
export function CornerRibbon({ label, bg, fg, side = "left", scale = 1 }: { label: string; bg: string; fg: string; side?: "left" | "right"; scale?: number }) {
  const right = side === "right";
  const k = (n: number) => Math.round(n * scale * 10) / 10;
  return (
    <View style={[styles.box, { width: k(90), height: k(90) }, right ? { left: "auto", right: 0 } : null]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.band,
          { left: k(-60), top: k(15), width: k(172), paddingVertical: k(4) },
          right ? { left: "auto", right: k(-60), transform: [{ rotate: "45deg" }] } : null,
          { backgroundColor: bg },
        ]}
      >
        <AppText variant="callout" style={[styles.text, { color: fg, fontSize: Math.max(9, k(11)), lineHeight: Math.max(12, k(14)) }]} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  band: { position: "absolute", transform: [{ rotate: "-45deg" }], alignItems: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  text: { fontWeight: "800", letterSpacing: 0.3 },
});
