import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

/**
 * 底部彈出面板的外框（從螢幕下方向上滑出、背後半透明、點外面等於取消）。
 * 「確認視窗」「改播詢問」等所有從下方彈出的面板都用它，樣式只在這裡改一次。
 */
export function BottomSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="關閉" onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: space.lg + insets.bottom }]} accessibilityViewIsModal>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, gap: space.md },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: space.xs },
});
