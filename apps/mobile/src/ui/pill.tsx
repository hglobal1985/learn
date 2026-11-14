import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText } from "./text";

export type PillTone = "neutral" | "accent" | "warning" | "danger" | "success" | "bright";

export function Pill({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  const { c, scheme } = useTheme();
  const [bg, fg] = {
    neutral: [c.surfaceMuted, c.textMuted],
    accent: [c.accentSoft, c.accentText],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    success: [c.successSoft, c.success],
    // 亮色強調（例如「已付費」）：明亮的黃底深字，在淺色與深色模式都醒目。
    bright: scheme === "dark" ? ["#F5C518", "#2A1D00"] : ["#FFD43B", "#5A3B00"],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <AppText variant="caption" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
});
