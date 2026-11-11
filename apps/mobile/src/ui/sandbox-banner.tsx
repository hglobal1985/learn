import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon } from "./icon";
import { AppText } from "./text";

/** 交接規範：模擬資料必須明確標示。 */
export function SandboxBanner({ text = "內部測試版：課程、會員與訂單皆為示範資料，只存在這台裝置。" }: { text?: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: c.warningSoft }]} accessibilityRole="text">
      <Icon name="flask-outline" size={16} color={c.warning} />
      <AppText variant="caption" tone="warning" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: space.sm, alignItems: "center", padding: space.md, borderRadius: radius.md },
});
