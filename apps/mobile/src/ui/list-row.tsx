import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, space } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { AppText } from "./text";

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  unread,
  highlight,
  dense,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  unread?: boolean;
  /** 整列加明顯底色（例如正在播放的章節）。 */
  highlight?: boolean;
  /** 緊湊列高（章節清單用）。 */
  dense?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [styles.row, dense && { minHeight: minTouch, paddingVertical: space.sm }, { borderBottomColor: c.border }, highlight && { backgroundColor: c.accentSoft, marginHorizontal: -space.lg, paddingHorizontal: space.lg }, pressed && { opacity: 0.7 }]}
    >
      {icon ? <Icon name={icon} size={22} color={c.textMuted} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="headline" style={unread ? undefined : { fontWeight: "500" }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="callout" tone="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {unread ? <View style={[styles.dot, { backgroundColor: c.accent }]} accessibilityLabel="未讀" /> : null}
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={c.textMuted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouch + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
