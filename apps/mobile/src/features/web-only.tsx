import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { Platform } from "react-native";

/** 付費購買與人工審核只在 Web 版（Apple/Google 規範）；App 開到這些頁面時導回我的課程。 */
export function WebOnly({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") return <Redirect href="/learning" />;
  return <>{children}</>;
}
