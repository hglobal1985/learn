import { StyleSheet, View } from "react-native";
import { AppText } from "./text";

/** 卡片左上角的斜緞帶（不擋點擊）。tone：warning＝橘色（倒數）、accent＝綠色（免費公開）。 */
export function CornerRibbon({ label, tone = "warning" }: { label: string; tone?: "warning" | "accent" }) {
  const bg = tone === "accent" ? "#0C603C" : "#E8710A";
  return (
    <View style={styles.box} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.band, { backgroundColor: bg }]}>
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
