import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { confirmAsk } from "@/features/confirm";
import { openAccountCenter } from "@/features/account-link";
import type { Achievement, AppConfig, Member } from "@/api/client";
import { canManageCourses } from "@/lib/roles";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, ListRow, LoadingView, NoticeBox, Pill, SandboxBanner, Screen, Section } from "@/ui";

/**
 * 頁尾：與寰宇中央會員網站的頁尾相同（淡色小字：左邊「隱私權政策」連結、右邊設計者署名）。
 * 只放在「設定」頁面最下方，其他頁面不顯示。尺寸與淺色模式的顏色照中央會員（14px、#5d6b62、署名 #cfd2c9）；深色模式用等比例的淡化色。
 */
function SiteFooter() {
  const { scheme } = useTheme();
  const link = scheme === "dark" ? "#a6adab" : "#5d6b62";
  const credit = scheme === "dark" ? "#3d4441" : "#cfd2c9";
  return (
    <View style={styles.foot}>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL("https://learn.hglobal1985.com/privacy")}>
        <Text style={[styles.footText, { color: link, textDecorationLine: "underline" }]}>隱私權政策</Text>
      </Pressable>
      <Text style={[styles.footText, styles.credit, { color: credit }]}>系統設計 杜杜龍</Text>
    </View>
  );
}

export default function MeScreen() {
  const { member, ready, signInGoogle, signInDemo, signOut, deleteAccount } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const back = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
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
  const removeAccount = async () => {
    const central = !member?.demo;
    const ok = await confirmAsk(
      "刪除帳號",
      central
        ? "將刪除你在本 App 的所有資料（學習紀錄、報名紀錄、徽章、通知）並登出，接著帶你前往會員中心刪除會員帳號。此操作無法復原。"
        : "將刪除這個測試帳號在本 App 的所有資料（學習紀錄、報名紀錄、徽章、通知）。",
      "確定刪除",
    );
    if (!ok) return;
    await run("delete", deleteAccount, central ? "已刪除你在本 App 的資料並登出。請在會員中心完成帳號刪除。" : "已刪除測試帳號的資料。");
    if (central) openAccountCenter();
  };
  const achievements = useApi<Achievement[]>(member ? "/me/achievements" : null);
  const earned = (achievements.data ?? []).filter((a) => a.earned);

  return (
    <Screen title="設定">
      {message ? <NoticeBox tone={message.tone} text={message.text} /> : null}
      {!ready ? <LoadingView /> : null}
      {member ? (
        <Card>
          <AppText variant="title">{member.name}</AppText>
          <View style={styles.row}>
            {member.rank ? <Pill label={member.rank.name} tone="accent" /> : null}
            {member.titles.length ? member.titles.map((t) => <Pill key={t} label={t} />) : <Pill label={member.role === "admin" ? "管理員" : "學員"} />}
            {member.center ? <Pill label={member.center} tone="accent" /> : null}
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
              登入後即可報名課程、記錄學習進度。課程的獎銜資格會依你在會員中心的資料自動判斷。
            </AppText>
            <View style={styles.row}>
              <Button label="使用 Google 登入" icon="logo-google" loading={busy === "google"} onPress={() => run("google", async () => {
                await signInGoogle(back ?? "/");
                router.replace((back ?? "/") as Href); // 登入後預設回首頁
              })} />
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
                    onPress={() => run(`in-${m.sub}`, async () => {
                      await signInDemo(m.sub);
                      router.replace((back ?? "/") as Href);
                    })}
                    right={busy === `in-${m.sub}` ? <AppText tone="muted">登入中…</AppText> : undefined}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </Section>
      ) : null}

      {member ? (
        <Card style={{ paddingVertical: 0 }}>
          <ListRow
            icon="trophy-outline"
            title="學習成就"
            subtitle={achievements.data ? `已取得 ${earned.length} / ${achievements.data.length} 枚徽章${earned.length ? `　${earned.slice(0, 6).map((a) => a.icon).join(" ")}` : ""}` : "查看你的學習徽章"}
            onPress={() => router.push("/achievements")}
          />
        </Card>
      ) : null}

      {member && (member.reviewer || member.role === "admin" || canManageCourses(member) || member.canViewStats) ? (
        <Section title="管理">
          <Card style={{ paddingVertical: 0 }}>
            {canManageCourses(member) ? <ListRow icon="ribbon-outline" title="課程設定" subtitle="新增／編輯課程、章節、影片與音檔" onPress={() => router.push("/admin/courses")} /> : null}
            {member.titles.includes("超級管理員") ? <ListRow icon="chatbubble-ellipses-outline" title="編輯學習金句" subtitle="首頁「繼續學習」下方的金句" onPress={() => router.push("/admin/quotes")} /> : null}
            {member.role === "admin" ? <ListRow icon="megaphone-outline" title="跑馬燈公告" subtitle="首頁公告：自動輪播、排序、停用" onPress={() => router.push("/admin/announcements")} /> : null}
            {isWeb && member.reviewer ? <ListRow icon="receipt-outline" title="報名審核" subtitle="確認繳費後開通、匯出對帳報表" onPress={() => router.push("/admin/orders")} /> : null}
            {isWeb && (member.role === "admin" || member.titles.includes("會長") || member.titles.includes("音控")) ? (
              <ListRow icon="people-outline" title="審核群組" subtitle="指定各中心的報名窗口、收費窗口、審核員" onPress={() => router.push("/admin/review-groups")} />
            ) : null}
            {member.canViewStats ? <ListRow icon="stats-chart-outline" title="統計分析" subtitle="Mux 免費額度用量、觀看與播放品質統計" onPress={() => router.push("/admin/stats")} /> : null}
            {member.titles.includes("超級管理員") ? <ListRow icon="swap-vertical-outline" title="課程排序與條件" subtitle="全部課程的排序優先順位、卡片緞帶文字與顏色" onPress={() => router.push("/admin/list-rules")} /> : null}
            {member.titles.includes("超級管理員") ? <ListRow icon="pricetags-outline" title="關鍵字管理" subtitle="集中新增、改名、刪除課程的分類、系列、場地" onPress={() => router.push("/admin/keywords")} /> : null}
            {member.titles.includes("超級管理員") ? <ListRow icon="trophy-outline" title="學習成就徽章設定" subtitle="設定要達成什麼條件才能獲得徽章" onPress={() => router.push("/admin/achievements")} /> : null}
            {member.role === "admin" ? <ListRow icon="flag-outline" title="留言檢舉" subtitle="處理被檢舉的留言" onPress={() => router.push("/admin/comments")} /> : null}
          </Card>
        </Section>
      ) : null}

      {member && isWeb ? (
        <Section title="報名">
          <Card style={{ paddingVertical: 0 }}>
            <ListRow icon="document-text-outline" title="我的報名" onPress={() => router.push("/orders")} />
          </Card>
        </Section>
      ) : null}

      {member ? (
        <Section title="帳號">
          <Card style={{ paddingVertical: 0 }}>
            {!member.demo ? (
              <ListRow icon="person-circle-outline" title="會員中心" subtitle="修改基本資料" onPress={openAccountCenter} />
            ) : null}
            <ListRow icon="trash-outline" title="刪除帳號" subtitle="刪除本 App 的所有資料，並前往會員中心刪除會員帳號" onPress={removeAccount} />
          </Card>
        </Section>
      ) : null}

      <SiteFooter />
      {member && !member.demo ? (
        <AppText variant="caption" tone="muted" selectable style={{ textAlign: "center" }}>
          會員 ID：{member.sub}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ foot: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 4, paddingBottom: 40 }, footText: { fontSize: 14, lineHeight: 23 }, credit: { flex: 1, textAlign: "right" }, row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs } });
