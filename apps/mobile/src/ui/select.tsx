import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText } from "./text";

export type SelectOption = { key: string; label: string };
export type SelectProps = {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (key: string) => void;
  /** 選項裡沒有符合 value 時顯示的文字。 */
  placeholder?: string;
};

/** 下拉選單（手機 App 版）：點開後從底部彈出選項清單。網頁版見 select.web.tsx（使用手機原生的選單，最順手）。 */
export function Select({ label, value, options, onChange, placeholder = "請選擇" }: SelectProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
        <AppText variant="body" numberOfLines={1} style={{ flex: 1, color: current ? c.text : c.textMuted }}>
          {current?.label ?? placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={c.textMuted} />
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="關閉" />
          <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: space.md + insets.bottom }]}>
            {label ? (
              <AppText variant="headline" style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
                {label}
              </AppText>
            ) : null}
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.key}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: o.key === value }}
                  onPress={() => {
                    setOpen(false);
                    onChange(o.key);
                  }}
                  style={[styles.item, { borderBottomColor: c.border }]}
                >
                  <AppText variant="body" style={{ flex: 1, fontWeight: o.key === value ? "700" : "400" }}>
                    {o.label}
                  </AppText>
                  {o.key === value ? <Ionicons name="checkmark" size={20} color={c.accent} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, flex: 1, minWidth: 0 },
  box: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.xs },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { maxHeight: "70%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  item: { minHeight: minTouch, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
});
