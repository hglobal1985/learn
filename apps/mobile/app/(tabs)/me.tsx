import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Platform, StyleSheet, View } from "react-native";
import type { Member } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, ListRow, LoadingView, NoticeBox, Pill, SandboxBanner, Screen, Section } from "@/ui";

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "取消", style: "cancel", onPress: () => resolve(false) },
      { text: "確定刪除", style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export default function MeScreen() {
  const { member, ready, signIn, signOut, deleteAccount } = useSession();
  const demo = useApi<Member[]>(member ? null : "/demo-members");
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
  const removeAccount = async () => {
    const ok = await confirm("刪除帳號資料", "將刪除你在寰宇行動大學的學習紀錄、訂單與通知，且無法復原。");
    if (ok) await run("delete", deleteAccount, "已刪除你在本 App 的資料。");
  };

  return (
    <Screen title="我的">
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      {!ready ? <LoadingView /> : null}
      {member ? (
        <Card>
          <AppText variant="title">{member.name}</AppText>
          <View style={styles.row}>
            <Pill label={member.rank.name} tone="accent" />
            <Pill label={member.role === "admin" ? "管理員" : "學員"} />
            {member.demo ? <Pill label="測試帳號" tone="warning" /> : null}
          </View>
          <View style={styles.row}>
            <Button variant="secondary" label="登出" icon="log-out-outline" loading={busy === "logout"} onPress={() => run("logout", signOut)} />
          </View>
        </Card>
      ) : ready ? (
        <Section title="模擬登入">
          <SandboxBanner text="正式版將使用寰宇中央會員登入；目前請選一個測試身分。" />
          {demo.loading && !demo.data ? <LoadingView /> : null}
          {demo.error ? <NoticeBox tone="danger" text={demo.error} /> : null}
          <Card style={{ paddingVertical: 0 }}>
            {(demo.data ?? []).map((m) => (
              <ListRow
                key={m.sub}
                icon={m.role === "admin" ? "shield-checkmark-outline" : "person-outline"}
                title={m.name}
                subtitle={`獎銜：${m.rank.name}`}
                onPress={() => run(`in-${m.sub}`, () => signIn(m.sub))}
                right={busy === `in-${m.sub}` ? <AppText tone="muted">登入中…</AppText> : undefined}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {member?.role === "admin" ? (
        <Section title="管理">
          <Card style={{ paddingVertical: 0 }}>
            {isWeb ? <ListRow icon="receipt-outline" title="訂單審核" subtitle="確認收款後開通課程" onPress={() => router.push("/admin/orders")} /> : null}
            <ListRow icon="ribbon-outline" title="課程與獎銜設定" subtitle="上下架、最低獎銜限制" onPress={() => router.push("/admin/courses")} />
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

      <Section title="其他">
        <Card style={{ paddingVertical: 0 }}>
          <ListRow icon="shield-outline" title="隱私政策" onPress={() => Linking.openURL("https://learn.hglobal1985.com/privacy")} />
          <ListRow
            icon="mail-outline"
            title="聯絡客服"
            subtitle="service@hglobal1985.com"
            onPress={() => Linking.openURL("mailto:service@hglobal1985.com")}
          />
          {member ? (
            <ListRow icon="trash-outline" title="刪除帳號資料" subtitle="刪除你在本 App 的學習紀錄、訂單與通知" onPress={removeAccount} />
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs } });
