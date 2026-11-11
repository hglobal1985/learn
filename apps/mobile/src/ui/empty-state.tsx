import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { AppText } from "./text";

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
        <Icon name={icon} size={28} color={c.accentText} />
      </View>
      <AppText variant="headline" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {body ? (
        <AppText tone="muted" variant="callout" style={{ textAlign: "center" }}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: space.sm, padding: space.xl, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
});
