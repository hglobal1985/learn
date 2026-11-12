import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Announcement, type CourseSummary } from "@/api/client";
import { ProfilePrompt } from "@/features/profile-prompt";
import { HomeRail } from "@/features/courses/home-rail";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { maxContentWidth, space } from "@/theme/tokens";
import { AppText, BrandTitle, Button, ErrorView, HomeRailsSkeleton, Ticker } from "@/ui";

/**
 * 首頁：固定一頁、不上下捲動。上方置中顯示大標題與會員頭像＋姓名（點擊進入會員中心編輯基本資料）、跑馬燈公告，下方左右兩個直式區塊（繼續學習、推薦課程），
 * 各自可以原地左右滑動瀏覽課程海報（EDM 本身，沒有 EDM 就用課程名稱）。推薦課程只顯示符合會員獎銜、尚未報名的課程。
 */
// 每次登入只彈一次（登出後再登入會再提示）。
let promptedFor: string | null = null;

export default function HomeScreen() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { member } = useSession();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { data, error, reload } = useApi<CourseSummary[]>("/courses");
  const [quote, setQuote] = useState<string | null>(null);
  const [noticeClosed, setNoticeClosed] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  useEffect(() => {
    if (!member) promptedFor = null;
    else if (member.profileMissing?.length && promptedFor !== member.sub) {
      promptedFor = member.sub;
      setPromptOpen(true);
    }
  }, [member]);
  // 每次進入首頁換一則學習金句。
  useFocusEffect(
    useCallback(() => {
      setNoticeClosed(false); // 每次進入首頁，公告都會再顯示
      api<{ text: string | null }>("GET", "/quotes/random")
        .then((r) => setQuote(r.text))
        .catch(() => undefined);
    }, []),
  );
  const notices = useApi<Announcement[]>("/announcements", { early: true });
  const courses = data ?? [];
  const mine = courses
    .filter((x) => x.enrollment === "opened")
    .sort((a, b) => Number(b.completedLessons < b.lessonCount) - Number(a.completedLessons < a.lessonCount));
  const recommended = courses.filter((x) => x.status === "published" && x.eligible && x.enrollment !== "opened");
  return (
    <>
    {promptOpen && member ? <ProfilePrompt onClose={() => setPromptOpen(false)} /> : null}
    <View style={[styles.page, { backgroundColor: c.background, paddingTop: insets.top + space.md }]}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <BrandTitle />
          {member ? (
            <Pressable
              onPress={member.demo ? undefined : () => setPromptOpen(true)}
              disabled={member.demo}
              accessibilityRole="button"
              accessibilityLabel={`${member.name}，完善與編輯會員基本資料`}
              style={styles.who}
            >
              {member.avatarUrl && !avatarFailed ? (
                <Image source={{ uri: member.avatarUrl }} onError={() => setAvatarFailed(true)} style={[styles.avatar, { backgroundColor: c.surfaceMuted }]} accessibilityIgnoresInvertColors />
              ) : (
                <View style={[styles.avatar, { backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }]}>
                  <AppText variant="title" style={{ color: c.accentText }}>
                    {member.name.trim().slice(0, 1) || "?"}
                  </AppText>
                </View>
              )}
              <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1, fontWeight: "400" }}>
                {member.name}
              </AppText>
              {member.rankLabel ? (
                <View style={[styles.rank, scheme === "dark" && { borderColor: "#6b5424", backgroundColor: "#3a2e17" }]}>
                  <AppText variant="callout" style={{ color: scheme === "dark" ? "#f0a050" : "#cc6c0c", fontWeight: "700", lineHeight: 20 }}>
                    {member.rankLabel}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <View style={styles.loginBtn}>
              <Button label="前往登入" icon="log-in-outline" onPress={() => router.navigate("/me")} fullWidth />
            </View>
          )}
        </View>
        {noticeClosed ? null : <Ticker items={(notices.data ?? []).map((n) => n.text)} onClose={() => setNoticeClosed(true)} />}
        {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
        {!data && !error ? <HomeRailsSkeleton /> : null}
        {data ? (
          <View style={styles.middle}>
          <View style={styles.rails}>
            <HomeRail
              title="繼續學習"
              icon="book-outline"
              tone="green"
              courses={mine}
              note={quote ?? undefined}
              progress
              empty={
                member ? (
                  <AppText variant="callout" tone="muted" style={{ textAlign: "center" }}>
                    還沒有已報名的課程，到「全部課程」看看。
                  </AppText>
                ) : (
                  <>
                    <AppText variant="callout" tone="muted" style={{ textAlign: "center" }}>
                      登入後顯示你已報名的課程。
                    </AppText>
                  </>
                )
              }
            />
            <HomeRail
              title="推薦課程"
              icon="sparkles-outline"
              tone="orange"
              courses={recommended}
              note="只顯示符合獎銜資格的課程"
              empty={
                <AppText variant="callout" tone="muted" style={{ textAlign: "center" }}>
                  {member ? "目前沒有符合你獎銜、尚未報名的課程。" : "登入後顯示符合你獎銜的課程。"}
                </AppText>
              }
            />
          </View>
          </View>
        ) : null}
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", paddingHorizontal: space.md, overflow: "hidden" },
  inner: { width: "100%", maxWidth: maxContentWidth, gap: space.md, flex: 1 },
  head: { alignItems: "center", gap: space.sm },
  who: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.md, minHeight: 56, maxWidth: "100%" },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  logo: { width: 44, height: 44 },
  rank: { borderWidth: 1, borderColor: "#e6c48c", backgroundColor: "#fdf0e3", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2 },
  loginBtn: { width: "100%", maxWidth: 420, minHeight: 56, justifyContent: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  rails: { flex: 1, flexDirection: "row", gap: space.md, alignItems: "stretch" },
  middle: { flex: 1, paddingBottom: space.sm },
});
