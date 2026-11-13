import type { Track } from "./engine.types";

/** 「改播另一堂？」詢問的狀態（不含畫面）。畫面見 switch-sheet.tsx。 */
export type SwitchPrompt = { from: Track; to: Track; resolve: (ok: boolean) => void };

/** 沒有操作時，倒數幾秒後視同「同意改播」。 */
export const SWITCH_COUNTDOWN_SECONDS = 15;

let current: SwitchPrompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const switchPromptStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  get: () => current,
};

/** 詢問使用者要不要中斷正在播放的這一堂。回傳 true＝改播新的；false＝繼續原本的。 */
export function askSwitch(from: Track, to: Track): Promise<boolean> {
  current?.resolve(false); // 又有新的詢問進來：前一個視為「繼續原本的」
  return new Promise<boolean>((done) => {
    const p: SwitchPrompt = {
      from,
      to,
      resolve: (ok) => {
        if (current === p) {
          current = null;
          emit();
        }
        done(ok);
      },
    };
    current = p;
    emit();
  });
}
