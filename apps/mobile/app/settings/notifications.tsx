import { useEffect, useState } from "react";
import { api, type NotificationSettings } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { AppText, Button, Card, EmptyState, ErrorView, Field, LoadingView, NoticeBox, Screen, Section } from "@/ui";

/** 通知設定：Email 是會員中心「聯絡信箱」的同一個欄位，這裡改就是改會員中心。 */
export default function NotificationSettingsScreen() {
  const { member } = useSession();
  const { data, error, reload } = useApi<NotificationSettings>(member ? "/me/notification-settings" : null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (data) setEmail(data.email ?? "");
  }, [data]);
  if (!member) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="請先登入" /></Screen>;
  if (!data) return <Screen header={false}>{error ? <ErrorView message={error} onRetry={reload} /> : <LoadingView />}</Screen>;

  const save = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await api<NotificationSettings>("PUT", "/me/notification-settings", body);
      setMsg({ text: done, ok: true });
      reload();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "儲存失敗，請稍後再試", ok: false });
    }
    setBusy(false);
  };
  const changed = email.trim().toLowerCase() !== (data.email ?? "");

  return (
    <Screen header={false}>
      <Section title="通知方式">
        <Card>
          <AppText variant="headline">站內通知</AppText>
          <AppText tone="muted">一定會收到，在「通知」分頁查看。</AppText>
        </Card>
        <Card>
          <AppText variant="headline">Email 通知</AppText>
          {!data.emailReady ? <NoticeBox text="Email 通知尚未開放，之後開放時會依你的設定寄出。" /> : null}
          <Field
            label="聯絡信箱"
            value={email}
            onChange={setEmail}
            placeholder="name@example.com"
            hint={data.source === "central" ? "這和會員中心的「聯絡信箱」是同一個欄位，在這裡修改會同步更新會員中心，不影響登入。" : "測試帳號的信箱只存在本 App。"}
          />
          <Button label="儲存信箱" disabled={busy || !changed} onPress={() => save({ email: email.trim() || null }, email.trim() ? "已儲存信箱" : "已清除信箱")} />
          <Button
            variant="secondary"
            label={data.notifyEmail ? "目前：會寄 Email（點此關閉）" : "目前：不寄 Email（點此開啟）"}
            disabled={busy}
            onPress={() => save({ notifyEmail: !data.notifyEmail }, data.notifyEmail ? "已關閉 Email 通知" : "已開啟 Email 通知")}
          />
          {!data.email ? <AppText variant="caption" tone="muted">還沒有信箱，所以目前不會寄 Email。</AppText> : null}
        </Card>
        <Card>
          <AppText variant="headline">手機推播</AppText>
          <AppText tone="muted">即將推出。</AppText>
        </Card>
      </Section>
      {msg ? <NoticeBox text={msg.text} tone={msg.ok ? "success" : "danger"} /> : null}
    </Screen>
  );
}
