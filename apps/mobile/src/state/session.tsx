import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { clearCentral, handleWebSsoReturn, hasCentralSession, signInWithGoogle, signOutCentral, webSsoCheck, webSsoLogout } from "@/api/central";
import { api, loadToken, saveToken, type Member } from "@/api/client";

/**
 * 登入狀態、資料重新整理訊號與（Web 限定的）報名清單。
 * 正式登入：中央會員（Google）；內部測試另有模擬會員（伺服器開啟 DEMO_LOGIN 時才可用）。
 * 任何會改變資料的動作完成後呼叫 `invalidate()`，所有畫面會重新抓資料。
 */
type Session = {
  ready: boolean;
  member: Member | null;
  /** returnTo：登入完成後要回到的頁面。 */
  signInGoogle: (returnTo?: string) => Promise<void>;
  signInDemo: (sub: string) => Promise<void>;
  /** Web 登入回來後（/auth/done）重新載入會員。 */
  reloadMember: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  version: number;
  invalidate: () => void;
  cart: string[];
  setCart: (ids: string[]) => void;
  /** Web 共用登入回傳（/auth/sso）處理完後要前往的頁面。 */
  ssoNext: string | null;
};

const SessionContext = createContext<Session | null>(null);
const CART_KEY = "hglobal:learn:cart";

/** 取得目前登入的會員。連線失敗時重試一次；仍失敗回傳 "offline"（不可因此清除登入）。 */
async function fetchMember(): Promise<Member | null | "offline"> {
  for (let i = 0; i < 2; i++) {
    try {
      return (await api<{ member: Member | null }>("GET", "/me")).member;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return "offline";
}
const known = (m: Member | null | "offline"): Member | null => (m === "offline" ? null : m);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [version, setVersion] = useState(0);
  const [cart, setCartState] = useState<string[]>([]);
  const [ssoNext, setSsoNext] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(CART_KEY).catch(() => null);
      if (raw) setCartState(JSON.parse(raw) as string[]);
      const demo = await loadToken();
      const first = demo || (await hasCentralSession()) ? await fetchMember() : null;
      // 只有伺服器明確回覆「未登入」才清除；連線失敗時保留登入，下次再試。
      if (demo && first === null) await saveToken(null);
      let m = known(first);
      if (Platform.OS === "web" && !m?.demo) {
        // 共用登入：處理會員中心回傳，或（5 分鐘節流）詢問這個瀏覽器目前登入的會員。
        if (globalThis.location?.pathname === "/auth/sso") {
          const r = await handleWebSsoReturn(m?.sub ?? null);
          if (r.changed) m = known(await fetchMember());
          setSsoNext(r.next);
        } else if (m) {
          // 已經登入：共用登入的檢查放到背景做，不要讓使用者先等它（若需要會自動換頁）。
          webSsoCheck().catch(() => false);
        } else if (await webSsoCheck()) return "redirecting";
      }
      setMember(m);
    })().then((r) => r !== "redirecting" && setReady(true), () => setReady(true));
  }, []);

  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const setCart = useCallback((ids: string[]) => {
    setCartState(ids);
    AsyncStorage.setItem(CART_KEY, JSON.stringify(ids)).catch(() => undefined);
  }, []);
  const reloadMember = useCallback(async () => {
    setMember(known(await fetchMember()));
    invalidate();
  }, [invalidate]);
  const signInGoogle = useCallback(async (returnTo = "/me") => {
    await saveToken(null);
    const result = await signInWithGoogle(returnTo);
    if (result !== "ok") return;
    const m = known(await fetchMember());
    if (!m) throw Error("登入沒有成功，請再試一次");
    setMember(m);
    setCart([]);
    invalidate();
  }, [invalidate, setCart]);
  const signInDemo = useCallback(
    async (sub: string) => {
      await clearCentral();
      const r = await api<{ token: string; member: Member }>("POST", "/auth/demo", { sub });
      await saveToken(r.token);
      setMember(r.member);
      setCart([]);
      invalidate();
    },
    [invalidate, setCart],
  );
  const signOut = useCallback(async () => {
    if (member?.demo) await api("POST", "/auth/logout").catch(() => undefined);
    else {
      await signOutCentral();
      if (Platform.OS === "web") {
        await saveToken(null);
        webSsoLogout("/me"); // 登出這個瀏覽器的所有 App
        return;
      }
    }
    await saveToken(null);
    setMember(null);
    setCart([]);
    invalidate();
  }, [invalidate, setCart, member?.demo]);
  /** 刪除本 App 的學習資料並登出；中央會員帳號本身由「會員中心」的官方流程刪除。 */
  const deleteAccount = useCallback(async () => {
    await api("DELETE", "/me");
    if (!member?.demo) await signOutCentral();
    await saveToken(null);
    setMember(null);
    setCart([]);
    invalidate();
  }, [invalidate, setCart, member?.demo]);

  const value = useMemo(
    () => ({ ready, member, signInGoogle, signInDemo, reloadMember, signOut, deleteAccount, version, invalidate, cart, setCart, ssoNext }),
    [ready, member, signInGoogle, signInDemo, reloadMember, signOut, deleteAccount, version, invalidate, cart, setCart, ssoNext],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw Error("useSession 必須在 SessionProvider 內使用");
  return s;
}

/** 讀取 API 資料：登入狀態改變、資料被異動、或畫面回到前景時自動重新抓取。 */
/** early：公開資料（公告等）不必等登入狀態載入完成，頁面一開就先抓。 */
export function useApi<T>(path: string | null, opts: { early?: boolean } = {}): { data: T | undefined; error: string | null; loading: boolean; reload: () => void } {
  const { version, member, ready } = useSession();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(() => {
    if ((!ready && !opts.early) || !path) return;
    const id = ++seq.current;
    setLoading(true);
    api<T>("GET", path)
      .then((d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => id === seq.current && setError(e.message))
      .finally(() => id === seq.current && setLoading(false));
  }, [path, ready, opts.early]);
  // member?.sub 與 version 變動時重新抓取。
  useEffect(load, [load, version, member?.sub]);
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) load();
      focused.current = true;
    }, [load]),
  );
  return { data, error, loading: loading || !ready, reload: load };
}
