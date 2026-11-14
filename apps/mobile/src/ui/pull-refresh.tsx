import { useState, type ReactElement } from "react";
import { RefreshControl } from "react-native";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";

/**
 * 手機下拉重新整理（App 沒有重新整理鈕）：重新向會員中心拿最新獎銜與資料，並重新載入這一頁的清單。
 * 登入後才有；所有可捲動的頁面（共用外框 Screen 與首頁）都用這一個，要改下拉的行為只改這裡。
 */
export function usePullRefresh(): ReactElement | undefined {
  const { c } = useTheme();
  const { member, refreshMember, invalidate } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  if (!member) return undefined;
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshMember(0);
      invalidate();
    } finally {
      setRefreshing(false);
    }
  };
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />;
}
