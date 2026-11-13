import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState, type ElementRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BottomSheet } from "./bottom-sheet";
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

/** 下拉選單（App 與網頁一律用這個）：點開後從畫面下方彈出選項面板（不使用瀏覽器或系統內建的選單），目前選的項目打勾，開啟時自動捲到該項。 */
export function Select({ label, value, options, onChange, placeholder = "請選擇" }: SelectProps) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const scroller = useRef<ElementRef<typeof ScrollView>>(null);
  const current = options.find((o) => o.key === value);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
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
      {open ? (
        <BottomSheet onClose={() => setOpen(false)}>
          {label ? <AppText variant="headline">{label}</AppText> : null}
          <ScrollView ref={scroller} style={{ maxHeight: 380 }} onLayout={() => scroller.current?.scrollTo({ y: Math.max(0, (index - 2) * ITEM_H), animated: false })}>
            {options.map((o) => {
              const on = o.key === value;
              return (
                <Pressable
                  key={o.key}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setOpen(false);
                    onChange(o.key);
                  }}
                  style={[styles.item, { borderBottomColor: c.border, backgroundColor: on ? c.accentSoft : "transparent" }]}
                >
                  <AppText variant="body" style={{ flex: 1, fontWeight: on ? "700" : "400", color: on ? c.accentText : c.text }}>
                    {o.label}
                  </AppText>
                  {on ? <Ionicons name="checkmark" size={22} color={c.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const ITEM_H = minTouch + 4;
const styles = StyleSheet.create({
  wrap: { gap: 4, flex: 1, minWidth: 0 },
  box: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.xs },
  item: { minHeight: minTouch + 4, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
