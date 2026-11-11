import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import { ACCOUNT_URL } from "@/api/central";
import type { AppConfig, Member } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, ListRow, LoadingView, NoticeBox, Pill, SandboxBanner, Screen, Section } from "@/ui";

function confirm(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "取消", style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

const openAccountCenter = () => (Platform.OS === "web" ? Linking.openURL(ACCOUNT_URL) : WebBrowser.openBrowserAsync(ACCOUNT_URL));

export default function MeScreen() {
  const { member, ready, signInGoogle, signInDemo, signOut, deleteAccount } = useSession();
  const config = useApi<AppConfig>("/config");
  const demo = useApi<Member[]>(!member && config.data?.demoLogin ? "/demo-members" : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const isWeb = Platform.OS === "web";

  const run = async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      if (done) setMessage({ tone: "success", text: done });
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const removeData = async () => {
    const central = !member?.demo;
    const ok = await confirm(
      "刪除學習資料",
      central
        ? "將刪除你在本 App 的學習紀錄、訂單與通知，並登出。若要刪除整個會員帳號，請到「會員中心」辦理。"
        : "將刪除這個測試帳號在本 App 的學習紀錄、訂單與通知。",
      "確定刪除",
    );
    if (ok) await run("delete", deleteAccount, central ? "已刪除你在本 App 的資料並登出。" : "已刪除測試帳號的資料。");
  };

  return (
    <Screen title="我的">
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      {!ready ? <LoadingView /> : null}
      {member ? (
        <Card>
          <AppText variant="title">{member.name}</AppText>
          {!member.demo ? (
            <AppText variant="caption" tone="muted" selectable>
              會員 ID：{member.sub}
            </AppText>
          ) : null}
          <View style={styles.row}>
            {member.rank ? <Pill label={member.rank.name} tone="accent" /> : null}
            <Pill label={member.role === "admin" ? "管理員" : "學員"} />
            {member.demo ? <Pill label="測試帳號" tone="warning" /> : null}
          </View>
          <View style={styles.row}>
            <Button
              variant="secondary"
              label={member.demo ? "登出" : "登出所有 App"}
              icon="log-out-outline"
              loading={busy === "logout"}
              onPress={() => run("logout", signOut)}
            />
          </View>
        </Card>
      ) : ready ? (
        <Section title="登入">
          <Card>
            <AppText variant="headline">使用 Google 帳號登入</AppText>
            <AppText variant="callout" tone="muted">
              登入後即可領取課程、記錄學習進度。課程的獎銜資格會依你在會員中心的資料自動判斷。
            </AppText>
            <View style={styles.row}>
              <Button label="使用 Google 登入" icon="logo-google" loading={busy === "google"} onPress={() => run("google", signInGoogle)} />
            </View>
          </Card>
          {config.data?.demoLogin ? (
            <>
              <SandboxBanner text="內部測試：也可以用以下測試身分登入（資料為示範用）。" />
              <Card style={{ paddingVertical: 0 }}>
                {(demo.data ?? []).map((m) => (
                  <ListRow
                    key={m.sub}
                    icon={m.role === "admin" ? "shield-checkmark-outline" : "person-outline"}
                    title={m.name}
                    subtitle={m.rank ? `示範獎銜：${m.rank.name}` : undefined}
                    onPress={() => run(`in-${m.sub}`, () => signInDemo(m.sub))}
                    right={busy === `in-${m.sub}` ? <AppText tone="muted">登入中…</AppText> : undefined}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </Section>
      ) : null}

      {member?.role === "admin" ? (
        <Section title="管理">
          <Card style={{ paddingVertical: 0 }}>
            {isWeb ? <ListRow icon="receipt-outline" title="訂單審核" subtitle="確認收款後開通課程" onPress={() => router.push("/admin/orders")} /> : null}
            <ListRow icon="ribbon-outline" title="課程設定" subtitle="上下架、最低獎銜、各堂影片" onPress={() => router.push("/admin/courses")} />
          </Card>
        </Section>
      ) : null}

      {member && isWeb ? (
        <Section title="訂單">
          <Card style={{ paddingVertical: 0 }}>
            <ListRow icon="document-text-outline" title="我的訂單" onPress={() => router.push("/orders")} />
          </Card>
        </Section>
      ) : null}

      {member ? (
        <Section title="帳號">
          <Card style={{ paddingVertical: 0 }}>
            {!member.demo ? (
              <ListRow icon="person-circle-outline" title="會員中心" subtitle="修改基本資料、刪除會員帳號" onPress={openAccountCenter} />
            ) : null}
            <ListRow icon="trash-outline" title="刪除學習資料" subtitle="刪除本 App 的學習紀錄、訂單與通知" onPress={removeData} />
          </Card>
        </Section>
      ) : null}

      <Section title="其他">
        <Card style={{ paddingVertical: 0 }}>
          <ListRow icon="shield-outline" title="隱私權政策" onPress={() => Linking.openURL("https://learn.hglobal1985.com/privacy")} />
          <ListRow icon="help-circle-outline" title="客服與說明" onPress={() => Linking.openURL("https://learn.hglobal1985.com/support")} />
          <ListRow icon="mail-outline" title="聯絡客服" subtitle="service@hglobal1985.com" onPress={() => Linking.openURL("mailto:service@hglobal1985.com")} />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs } });
