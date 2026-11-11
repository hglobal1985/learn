import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { initialState, noticesFor, type Member, type State } from "@/domain/domain";

/**
 * 示範資料的本機狀態（AsyncStorage：iOS/Android 原生儲存，Web 為 localStorage）。
 * 之後串接後端 API 時，只替換這一層，畫面不用改。
 */
const storageKey = "hglobal:learn-mobile:sandbox:v1";

type Store = {
  state: State;
  ready: boolean;
  update: (fn: (s: State) => State) => void;
  signIn: (member: Member) => void;
  signOut: () => void;
  reset: () => void;
  unreadCount: number;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as State;
        if (parsed?.version === 1) setState(parsed);
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => undefined);
  }, [state]);

  const update = useCallback((fn: (s: State) => State) => setState((s) => fn(s)), []);
  const signIn = useCallback((member: Member) => setState((s) => ({ ...s, member, cart: [] })), []);
  const signOut = useCallback(() => setState((s) => ({ ...s, member: null, cart: [] })), []);
  const reset = useCallback(() => setState(initialState()), []);
  const unreadCount = useMemo(() => noticesFor(state).filter((n) => !n.read).length, [state]);

  const value = useMemo(
    () => ({ state, ready, update, signIn, signOut, reset, unreadCount }),
    [state, ready, update, signIn, signOut, reset, unreadCount],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw Error("useStore 必須在 StoreProvider 內使用");
  return store;
}
