import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Announcement, type CourseSummary } from "@/api/client";
import { MemberHeader } from "@/features/member-header";
import { ProfilePrompt } from "@/features/profile-prompt";
import { HomeRail } from "@/features/courses/home-rail";
import { collapseSeries } from "@/features/courses/sort";
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
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { member } = useSession();
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
    // 與「學習中」頁同一個規則：已開通或播放超過 1% 的課程（被隱藏的不列）。
    .filter((x) => (x.enrollment === "opened" || x.started) && !x.hiddenFromLearning)
    .sort((a, b) => Number(b.completedLessons < b.lessonCount) - Number(a.completedLessons < a.lessonCount));
  // 會員：符合獎銜、尚未報名的課程；訪客：完全公開的課程。
  const recommendedAll = courses.filter((x) => x.status === "published" && x.enrollment !== "opened" && !x.started && !x.hideFromHome && (member ? x.eligible && !x.isPublic : x.isPublic));
  // 同系列的課只推薦最近的一場。
  const recommended = collapseSeries(recommendedAll, recommendedAll).map((e) => e.course);
  return (
    <>
    {promptOpen && member ? <ProfilePrompt onClose={() => setPromptOpen(false)} initial={member.profileForm ?? null} /> : null}
    <View style={[styles.page, { backgroundColor: c.background, paddingTop: insets.top + space.md }]}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <BrandTitle />
          {member ? (
            <MemberHeader member={member} onPress={member.demo ? undefined : () => setPromptOpen(true)} />
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
              note="顯示您可報名的課程"
              empty={
                <AppText variant="callout" tone="muted" style={{ textAlign: "center" }}>
                  {member ? "目前沒有符合你獎銜、尚未報名的課程。" : "目前沒有公開的課程，登入後顯示您可報名的課程。"}
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
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  logo: { width: 44, height: 44 },
  loginBtn: { width: "100%", maxWidth: 420, minHeight: 56, justifyContent: "center" },
  rails: { flex: 1, flexDirection: "row", gap: space.md, alignItems: "stretch" },
  middle: { flex: 1, paddingBottom: space.sm },
});
