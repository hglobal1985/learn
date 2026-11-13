import { createElement } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText } from "./text";
import type { SelectProps } from "./select";

/** 下拉選單（網頁版）：用瀏覽器原生的 <select>，手機上會跳出系統的選單，最順手也最不會被鍵盤擋住。 */
export function Select({ label, value, options, onChange, placeholder = "請選擇" }: SelectProps) {
  const { c } = useTheme();
  const known = options.some((o) => o.key === value);
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
      ) : null}
      {createElement(
        "select",
        {
          value: known ? value : "",
          "aria-label": label,
          onChange: (e: { target: { value: string } }) => onChange(e.target.value),
          style: {
            width: "100%",
            minHeight: minTouch,
            fontSize: 16, // 16px 以上，iPhone 不會自動放大畫面
            fontFamily: "inherit",
            color: c.text,
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: radius.md,
            padding: `0 ${space.sm}px`,
            boxSizing: "border-box",
          },
        },
        !known ? createElement("option", { key: "__empty", value: "", disabled: true }, placeholder) : null,
        ...options.map((o) => createElement("option", { key: o.key, value: o.key }, o.label)),
      )}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: 4, flex: 1, minWidth: 0 } });
