import { useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { Icon } from "./icon";
import { AppText } from "./text";

const ROW = 48; // 每則公告一格的高度（最多兩行字）
const EVERY = 4000; // 自動輪播間隔
const PAUSE = 8000; // 手指滑過之後暫停自動輪播的時間

/**
 * 首頁跑馬燈：多則公告自動上下滾動輪流播放，也可以用手指上下滑動快速查看。
 * 只有一則時不捲動。接在最後多放一份第一則，捲到底後無縫跳回第一則。
 */
export function Ticker({ items, onClose }: { items: string[]; onClose?: () => void }) {
  const { c } = useTheme();
  const ref = useRef<ScrollViewInstance | null>(null);
  const index = useRef(0);
  const pausedUntil = useRef(0);
  const [, force] = useState(0);
  const loop = items.length > 1;
  const rows = loop ? [...items, items[0]] : items;

  const goto = (i: number, animated: boolean) => {
    index.current = i;
    ref.current?.scrollTo({ y: i * ROW, animated });
  };

  useEffect(() => {
    index.current = 0;
    ref.current?.scrollTo({ y: 0, animated: false });
    if (!loop) return;
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const next = index.current + 1;
      goto(next, true);
      if (next >= items.length) setTimeout(() => goto(0, false), 600); // 到了複製的第一則：動畫結束後無縫跳回
    }, EVERY);
    return () => clearInterval(t);
  }, [items.join("\u0001")]); // eslint-disable-line react-hooks/exhaustive-deps

  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ROW);
    index.current = i;
    if (loop && i >= items.length) goto(0, false);
    force((n) => n + 1);
  };

  if (!items.length) return null;
  return (
    <View style={[styles.box, { backgroundColor: c.warningSoft }]} accessibilityRole="text" accessibilityLabel={`公告：${items.join("；")}`}>
      <Icon name="megaphone-outline" size={18} color={c.warning} />
      <ScrollView
        ref={ref}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={loop}
        snapToInterval={ROW}
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled
        onScrollBeginDrag={() => (pausedUntil.current = Date.now() + PAUSE)}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          pausedUntil.current = Date.now() + PAUSE;
          if (!e.nativeEvent.velocity?.y) settle(e);
        }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          // 網頁版不一定會送出「滑動結束」事件，所以停止滑動 0.2 秒後自己結算位置。
          const y = e.nativeEvent.contentOffset.y;
          if (idle.current) clearTimeout(idle.current);
          idle.current = setTimeout(() => {
            index.current = Math.round(y / ROW);
            if (loop && index.current >= items.length) goto(0, false);
          }, 200);
        }}
      >
        {rows.map((text, i) => (
          <View key={`${i}-${text}`} style={styles.row}>
            <AppText variant="callout" numberOfLines={2} style={{ color: c.warning }}>
              {text}
            </AppText>
          </View>
        ))}
      </ScrollView>
      {onClose ? (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉公告" hitSlop={8} style={styles.close}>
          <Icon name="close" size={30} color={c.warning} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, height: ROW },
  scroll: { flex: 1, height: ROW },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -space.sm, alignSelf: "flex-start", marginTop: -space.xs },
  row: { height: ROW, justifyContent: "center" },
});
