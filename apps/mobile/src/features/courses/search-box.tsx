import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, type ElementRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, TextInput } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";

/** 收起來時只有一顆放大鏡（寬 minTouch）。 */
export const SEARCH_ICON_W = minTouch;

/**
 * 全部課程的搜尋框：收起來只有一個放大鏡圖示；點一下，輸入框從左邊向右伸展到整列寬度（動畫），
 * 並自動叫出鍵盤。右邊的 ✕ 清除文字並收起。放在列的最左邊（絕對定位蓋在分類下拉左側的空位上）。
 */
export function SearchBox({ open, onOpen, onClose, value, onChange, rowWidth }: { open: boolean; onOpen: () => void; onClose: () => void; value: string; onChange: (v: string) => void; rowWidth: number }) {
  const { c } = useTheme();
  const w = useRef(new Animated.Value(SEARCH_ICON_W)).current;
  const input = useRef<ElementRef<typeof TextInput>>(null);
  useEffect(() => {
    Animated.timing(w, { toValue: open ? Math.max(rowWidth, SEARCH_ICON_W) : SEARCH_ICON_W, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      if (open) input.current?.focus();
    });
  }, [open, rowWidth, w]);
  return (
    <Animated.View style={[styles.box, { width: w, borderColor: open ? c.accent : c.border, backgroundColor: c.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={open ? "搜尋" : "開啟搜尋"} onPress={open ? () => input.current?.focus() : onOpen} style={styles.icon}>
        <Ionicons name="search" size={22} color={open ? c.accentText : c.text} />
      </Pressable>
      {open ? (
        <>
          <TextInput
            ref={input}
            value={value}
            onChangeText={onChange}
            placeholder="主講人、獎銜、系列、章節、日期"
            placeholderTextColor={c.textMuted}
            accessibilityLabel="搜尋課程"
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.input, type.body, { color: c.text }, { outlineStyle: "none" } as object]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="清除搜尋並收起" onPress={onClose} hitSlop={6} style={styles.icon}>
            <Ionicons name="close-circle" size={22} color={c.textMuted} />
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", left: 0, bottom: 0, height: minTouch, borderWidth: 1, borderRadius: radius.md, flexDirection: "row", alignItems: "center", overflow: "hidden", zIndex: 5 },
  icon: { width: minTouch - 2, height: minTouch - 2, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, height: minTouch - 2, paddingHorizontal: space.xs },
});
