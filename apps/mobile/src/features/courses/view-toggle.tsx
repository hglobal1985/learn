import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, radius } from "@/theme/tokens";

export type CourseViewMode = "series" | "chapter";

/**
 * 課程清單的顯示模式切換（右邊兩顆圖示，放在分類下拉旁）：
 * ▦ 系列＝一個系列一張封面；☰ 章節＝一堂課一列。目前的模式反白（深綠底白圖示）。
 */
export function ViewToggle({ value, onChange }: { value: CourseViewMode; onChange: (v: CourseViewMode) => void }) {
  const { c } = useTheme();
  const item = (mode: CourseViewMode, icon: "grid-outline" | "list-outline", label: string) => {
    const on = value === mode;
    return (
      <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => onChange(mode)} style={[styles.btn, on && { backgroundColor: c.accent }]}>
        <Ionicons name={icon} size={22} color={on ? c.textOnAccent : c.text} />
      </Pressable>
    );
  };
  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.surface }]} accessibilityRole="radiogroup">
      {item("series", "grid-outline", "系列模式（封面牆）")}
      {item("chapter", "list-outline", "章節模式（一堂一列）")}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", borderWidth: 1, borderRadius: radius.md, overflow: "hidden", height: minTouch },
  btn: { width: 44, height: "100%", alignItems: "center", justifyContent: "center" },
});
