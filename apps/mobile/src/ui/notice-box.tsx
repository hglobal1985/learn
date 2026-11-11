import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { AppText } from "./text";

type Tone = "info" | "success" | "danger" | "warning";
const icons: Record<Tone, IconName> = {
  info: "information-circle-outline",
  success: "checkmark-circle-outline",
  danger: "alert-circle-outline",
  warning: "time-outline",
};

/** 行內提示（成功／錯誤／說明）。 */
export function NoticeBox({ tone = "info", text }: { tone?: Tone; text: string }) {
  const { c } = useTheme();
  const [bg, fg] = {
    info: [c.surfaceMuted, c.textMuted],
    success: [c.successSoft, c.success],
    danger: [c.dangerSoft, c.danger],
    warning: [c.warningSoft, c.warning],
  }[tone];
  return (
    <View style={[styles.box, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      <Icon name={icons[tone]} size={18} color={fg} />
      <AppText variant="callout" style={{ color: fg, flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ box: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.md, alignItems: "flex-start" } });
