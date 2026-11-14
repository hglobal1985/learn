import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { minTouch, space } from "@/theme/tokens";
import { AppText, Icon } from "@/ui";

const ENTRY = /_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/;
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * 網頁版的「有新版本」提示：網頁開著不重新載入就不會換新版，所以定期（回到網頁時、每 5 分鐘）
 * 偵測網站的主程式檔名有沒有變；變了就在底部選單上方顯示提示列，點一下重新載入。不會自動重新整理（避免打斷正在播放的影片）。
 */
export function UpdateNotice() {
  const { c } = useTheme();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const loaded = Array.from(document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src") ?? "").find((s) => ENTRY.test(s));
    const current = loaded ? ENTRY.exec(loaded)?.[0] : undefined;
    if (!current) return;
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/", { cache: "no-store" });
        const latest = ENTRY.exec(await res.text())?.[0];
        if (alive && latest && latest !== current) setStale(true);
      } catch {
        /* 沒網路就下次再檢查 */
      }
    };
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const id = setInterval(check, CHECK_EVERY_MS);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(id);
    };
  }, []);
  if (!stale) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="有新版本，點一下重新載入" onPress={() => window.location.reload()} style={[styles.bar, { backgroundColor: c.accent }]}>
      <View style={styles.row}>
        <Icon name="refresh" size={20} color={c.textOnAccent} />
        <AppText variant="callout" style={{ color: c.textOnAccent, fontWeight: "700", flexShrink: 1 }}>
          有新版本，點一下更新
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: minTouch, justifyContent: "center", paddingHorizontal: space.lg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
});
