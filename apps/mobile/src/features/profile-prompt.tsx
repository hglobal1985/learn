import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { openAccountCenter } from "@/features/account-link";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Button, Icon } from "@/ui";

/**
 * 會員資料未完整時的彈出視窗：蓋在首頁上層，四周各留約 30% 空白、內容可上下捲動；
 * 右上角大 X 可暫時關閉（下次登入會再提示）。填寫一律引導到中央會員（規則、審核與同意文字都在那裡）。
 */
export function ProfilePrompt({ missing, onClose }: { missing: string[]; onClose: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border, width: Math.max(280, width * 0.7), maxHeight: height * 0.7 }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉" hitSlop={8} style={styles.close}>
            <Icon name="close-circle" size={44} color={c.textMuted} />
          </Pressable>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator>
            <AppText variant="title" style={{ paddingRight: 48 }}>
              請完善會員基本資料
            </AppText>
            <AppText tone="muted">你的會員資料還有空白，需要填寫：</AppText>
            {missing.map((m) => (
              <AppText key={m} style={{ fontWeight: "700" }}>
                • {m}
              </AppText>
            ))}
            <AppText variant="callout" tone="muted">
              資料請到寰宇中央會員填寫，行動大學會自動同步。你也可以隨時點首頁的姓名與獎銜，進入會員中心完善更詳細的基本資料。
            </AppText>
            <Button label="前往會員中心填寫" icon="open-outline" onPress={openAccountCenter} fullWidth />
            <Button variant="ghost" label="暫時不要，下次登入再提醒我" onPress={onClose} fullWidth />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  box: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  close: { position: "absolute", top: 4, right: 4, zIndex: 2, width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  body: { padding: space.lg, gap: space.md },
});
