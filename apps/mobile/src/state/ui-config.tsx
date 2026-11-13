import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, DEFAULT_UI_CONFIG, type UiConfig } from "@/api/client";
import { useSession } from "./session";

const Ctx = createContext<{ config: UiConfig; reload: () => void }>({ config: DEFAULT_UI_CONFIG, reload: () => undefined });

/**
 * 畫面設定（課程排序優先順位、緞帶文字與顏色）：由超級管理員在「課程排序與條件」調整，
 * 一開啟 App 抓一次（公開、不用登入）；抓不到就用內建預設值。
 */
export function UiConfigProvider({ children }: { children: ReactNode }) {
  const { version } = useSession();
  const [config, setConfig] = useState<UiConfig>(DEFAULT_UI_CONFIG);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api<UiConfig>("GET", "/ui-config")
      .then(setConfig)
      .catch(() => undefined);
  }, [version, tick]);
  const value = useMemo(() => ({ config, reload: () => setTick((n) => n + 1) }), [config]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useUiConfig = () => useContext(Ctx);
