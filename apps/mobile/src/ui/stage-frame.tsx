import { forwardRef, type ElementRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { maxContentWidth } from "@/theme/tokens";

/**
 * 課程頁上方「舞台」：黑底滿版、中間是 16:9（最寬 maxContentWidth）。
 * 影片／YouTube 播放區與課程介紹頁的 EDM 區都用它，所以兩頁上方的高度永遠一模一樣，
 * 底下的內容不會因為切換頁面而上下跳動。要改高度或比例，只改這裡。
 */
export const StageFrame = forwardRef<ElementRef<typeof View>, { children?: ReactNode }>(function StageFrame({ children }, ref) {
  return (
    <View style={styles.band}>
      <View ref={ref} style={styles.inner}>
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  band: { backgroundColor: "#000", alignItems: "center" },
  inner: { width: "100%", maxWidth: maxContentWidth, aspectRatio: 16 / 9, overflow: "hidden" },
});
