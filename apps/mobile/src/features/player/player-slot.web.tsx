import { useFocusEffect } from "expo-router";
import { useCallback, useRef, type ElementRef } from "react";
import type { View } from "react-native";
import { StageFrame } from "@/ui/stage-frame";
import { engine } from "./engine.web";

/**
 * 課程頁釘在上方的影片區塊（Web）：只是一個佔位的 16:9 黑色舞台，把位置告訴全站播放器；
 * 真正的 <video>／iframe 由 PlayerLayer 疊在這個位置上，所以離開頁面不會被銷毀。
 */
export function PlayerSlot({ trackKey }: { trackKey: string }) {
  const ref = useRef<ElementRef<typeof View>>(null);
  // 只有這一頁「正在畫面上」才算內嵌；切到別頁時（上一頁仍留在背景）就交給浮動小視窗。
  useFocusEffect(
    useCallback(() => {
      engine.setSlot(trackKey, ref.current as unknown as HTMLElement);
      return () => engine.clearSlot(trackKey);
    }, [trackKey]),
  );
  return <StageFrame ref={ref} />;
}
