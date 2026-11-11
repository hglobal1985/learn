import { Platform } from "react-native";

/**
 * Apple / Google 規定：付費購買與人工審核流程只放 Web 版。
 * iOS / Android 不顯示價格、購買按鈕或外部付款連結；0 元課程三平台都可領。
 */
export const paidCommerceEnabled = Platform.OS === "web";
