import { StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText } from "./text";

/** 有標籤的文字輸入欄。 */
export function Field({ label, value, onChange, placeholder, multiline, numeric, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; numeric?: boolean; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="callout" tone="muted">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        keyboardType={numeric ? "number-pad" : "default"}
        autoCapitalize="none"
        accessibilityLabel={label}
        style={[styles.input, type.body, multiline && styles.multiline, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
      />
      {hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: "top" },
});
