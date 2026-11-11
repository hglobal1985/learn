import { Redirect } from "expo-router";

/** App 登入回傳的深層連結（learn://auth/google）。登入結果由系統登入視窗直接交回，這裡只負責導回「我的」。 */
export default function AuthGoogle() {
  return <Redirect href="/me" />;
}
