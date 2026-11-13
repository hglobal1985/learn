import { useSyncExternalStore } from "react";
import { engine } from "./engine";

/** 訂閱全站播放器的狀態（正在播什麼、播放中、位置…）。 */
export function usePlayer() {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
