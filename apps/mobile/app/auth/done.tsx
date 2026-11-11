import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { finishWebReturn } from "@/api/central";
import { useSession } from "@/state/session";
import { Button, LoadingView, NoticeBox, Screen } from "@/ui";

/** Web 登入中繼回傳頁：讀取 fragment 中的 id_token 完成登入（之後立即清掉網址中的資料）。 */
export default function AuthDone() {
  const { reloadMember } = useSession();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    finishWebReturn()
      .then(async (to) => {
        await reloadMember();
        router.replace(to as Href);
      })
      .catch((e: Error) => setError(e.message));
  }, [reloadMember]);
  return (
    <Screen title="登入">
      {error ? (
        <>
          <NoticeBox tone="danger" text={error} />
          <Button label="回到登入頁" onPress={() => router.replace("/me")} />
        </>
      ) : (
        <LoadingView />
      )}
    </Screen>
  );
}
