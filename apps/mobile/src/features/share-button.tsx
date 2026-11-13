import { Pressable, Text } from "react-native";
import { shareLink } from "@/lib/share";
import { useTheme } from "@/theme/theme";
import { minTouch } from "@/theme/tokens";
import { ShareIcon } from "@/ui";
import { showToast } from "@/ui/toast";

/**
 * 上方工具列（回上一頁那一列）靠右的分享按鈕：分享「這一頁」的網址，叫出系統分享選單；
 * 圖示用系統預設圖案（iOS／Mac＝方框加向上箭頭，Android＝三個圓點相連）。
 */
export function HeaderShare({ title, path }: { title: string; path: string }) {
  const { c } = useTheme();
  const share = async () => {
    const r = await shareLink(title, path);
    if (r === "copied") showToast("已複製連結");
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="分享這一頁" onPress={share} hitSlop={8} style={{ minWidth: minTouch, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 }}>
      <ShareIcon size={22} color={c.text} />
      <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>分享</Text>
    </Pressable>
  );
}
