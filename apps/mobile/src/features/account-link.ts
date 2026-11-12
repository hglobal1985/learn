import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";
import { ACCOUNT_URL } from "@/api/central";

/** 開啟中央會員的個人中心（基本資料編輯）。 */
export const openAccountCenter = () => (Platform.OS === "web" ? Linking.openURL(ACCOUNT_URL) : WebBrowser.openBrowserAsync(ACCOUNT_URL));
