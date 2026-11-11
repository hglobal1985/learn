import { Platform } from "react-native";

/**
 * Apple / Google 規定：付費報名與人工審核流程只放 Web 版。
 * iOS / Android 不顯示價格、報名按鈕或外部繳費連結；0 元課程三平台都可報名。
 */
export const paidCommerceEnabled = Platform.OS === "web";
