import { Linking, StyleSheet, View } from "react-native";
import { demoMembers } from "@/domain/domain";
import { useStore } from "@/state/store";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, ListRow, Pill, SandboxBanner, Screen, Section } from "@/ui";

export default function MeScreen() {
  const { state, signIn, signOut, reset } = useStore();
  const m = state.member;
  return (
    <Screen title="我的">
      {m ? (
        <Card>
          <AppText variant="title">{m.name}</AppText>
          <View style={styles.row}>
            <Pill label={m.rank} tone="accent" />
            <Pill label={m.role === "admin" ? "管理員" : "學員"} />
            <Pill label="測試帳號" tone="warning" />
          </View>
          <View style={styles.row}>
            <Button variant="secondary" label="登出" icon="log-out-outline" onPress={signOut} />
          </View>
        </Card>
      ) : (
        <Section title="模擬登入">
          <SandboxBanner text="正式版將使用寰宇中央會員登入；目前請選一個測試身分。" />
          <Card style={{ paddingVertical: 0 }}>
            {demoMembers.map((member) => (
              <ListRow
                key={member.id}
                icon={member.role === "admin" ? "shield-checkmark-outline" : "person-outline"}
                title={member.name}
                subtitle={`獎銜：${member.rank}`}
                onPress={() => signIn(member)}
              />
            ))}
          </Card>
        </Section>
      )}
      <Section title="其他">
        <Card style={{ paddingVertical: 0 }}>
          <ListRow
            icon="document-text-outline"
            title="隱私政策"
            onPress={() => Linking.openURL("https://learn.hglobal1985.com/privacy")}
          />
          <ListRow
            icon="mail-outline"
            title="聯絡客服"
            subtitle="service@hglobal1985.com"
            onPress={() => Linking.openURL("mailto:service@hglobal1985.com")}
          />
          <ListRow icon="refresh-outline" title="重設示範資料" subtitle="清除這台裝置上的測試訂單與通知" onPress={reset} />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs } });
