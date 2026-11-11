import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { useSession } from "@/state/session";
import { LoadingView, Screen } from "@/ui";

/** Web 共用登入回傳頁：結果由 SessionProvider 處理，這裡導回原本的頁面。 */
export default function AuthSso() {
  const { ready, ssoNext } = useSession();
  useEffect(() => {
    if (ready) router.replace((ssoNext ?? "/") as Href);
  }, [ready, ssoNext]);
  return (
    <Screen header={false}>
      <LoadingView />
    </Screen>
  );
}
