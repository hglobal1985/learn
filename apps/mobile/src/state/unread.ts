import type { Notice } from "@/api/client";
import { useApi, useSession } from "./session";

export function useUnreadCount(): number {
  const { member } = useSession();
  const { data } = useApi<Notice[]>(member ? "/notifications" : null);
  return member && data ? data.filter((n) => !n.read).length : 0;
}
