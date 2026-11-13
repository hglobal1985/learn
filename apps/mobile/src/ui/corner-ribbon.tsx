import { StyleSheet, View } from "react-native";
import { AppText } from "./text";

/**
 * 卡片角落的斜緞帶（不擋點擊）。side：left＝左上角（資格或狀態）、right＝右上角（日期倒數）。
 * 顏色與文字由「課程排序與條件」設定決定（色碼只能用寰宇生態系規範色）。
 */
export function CornerRibbon({ label, bg, fg, side = "left" }: { label: string; bg: string; fg: string; side?: "left" | "right" }) {
  const right = side === "right";
  return (
    <View style={[styles.box, right ? { left: "auto", right: 0 } : null]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.band, right ? { left: "auto", right: -60, transform: [{ rotate: "45deg" }] } : null, { backgroundColor: bg }]}>
        <AppText variant="callout" style={[styles.text, { color: fg }]} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", left: 0, top: 0, width: 90, height: 90, overflow: "hidden" },
  band: { position: "absolute", left: -60, top: 15, width: 172, paddingVertical: 4, transform: [{ rotate: "-45deg" }], alignItems: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  text: { fontWeight: "800", letterSpacing: 0.3, fontSize: 11, lineHeight: 14 },
});
