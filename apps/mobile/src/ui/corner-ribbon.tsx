import { StyleSheet, View } from "react-native";
import { AppText } from "./text";

/**
 * 卡片角落的斜緞帶（不擋點擊）。side：left＝左上角（預設）、right＝右上角。
 * tone：warning＝橘色（倒數）、accent＝綠色（免費公開）、danger＝紅色（獎銜不符）。
 */
export function CornerRibbon({ label, tone = "warning", side = "left" }: { label: string; tone?: "warning" | "accent" | "danger"; side?: "left" | "right" }) {
  const bg = tone === "accent" ? "#0C603C" : tone === "danger" ? "#B3261E" : "#E8710A";
  const right = side === "right";
  return (
    <View style={[styles.box, right ? { left: "auto", right: 0 } : null]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.band, right ? { left: "auto", right: -42, transform: [{ rotate: "45deg" }] } : null, { backgroundColor: bg }]}>
        <AppText variant="callout" style={styles.text} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", left: 0, top: 0, width: 128, height: 128, overflow: "hidden" },
  band: { position: "absolute", left: -42, top: 24, width: 172, paddingVertical: 6, transform: [{ rotate: "-45deg" }], alignItems: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  text: { color: "#FFFFFF", fontWeight: "800", letterSpacing: 1 },
});
