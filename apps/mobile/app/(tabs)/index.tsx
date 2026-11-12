import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Announcement, CourseSummary } from "@/api/client";
import { HomeRail } from "@/features/courses/home-rail";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { maxContentWidth, space } from "@/theme/tokens";
import { AppText, Button, ErrorView, LoadingView, Ticker } from "@/ui";

/**
 * 首頁：固定一頁、不上下捲動。上方是跑馬燈公告，下方左右兩個區塊（繼續學習、推薦課程），
 * 各自可以原地左右滑動瀏覽課程封面（16:9）。推薦課程只顯示符合會員獎銜、尚未報名的課程。
 */
export default function HomeScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { member } = useSession();
  const { data, error, loading, reload } = useApi<CourseSummary[]>("/courses");
  const notices = useApi<Announcement[]>("/announcements");
  const courses = data ?? [];
  const mine = courses
    .filter((x) => x.enrollment === "opened")
    .sort((a, b) => Number(b.completedLessons < b.lessonCount) - Number(a.completedLessons < a.lessonCount));
  const recommended = courses.filter((x) => x.status === "published" && x.eligible && x.enrollment !== "opened");
  const login = <Button label="前往登入" icon="log-in-outline" onPress={() => router.navigate("/me")} />;
  return (
    <View style={[styles.page, { backgroundColor: c.background, paddingTop: insets.top + space.md }]}>
      <View style={styles.inner}>
        <View>
          <AppText variant="title" accessibilityRole="header">
            寰宇行動大學
          </AppText>
          <AppText variant="callout" tone="muted">
            {member ? `${member.name}，歡迎回來` : "隨時隨地，持續成長"}
          </AppText>
        </View>
        <Ticker items={(notices.data ?? []).map((n) => n.text)} />
        {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingView /> : null}
        {data ? (
          <View style={styles.middle}>
          <View style={styles.rails}>
            <HomeRail
              title="繼續學習"
              courses={mine}
              seeAll="已報名"
              onSeeAll={() => router.navigate("/learning")}
              progress
              empty={
                member ? (
                  <AppText variant="caption" tone="muted">
                    還沒有已報名的課程，到「全部課程」看看。
                  </AppText>
                ) : (
                  <>
                    <AppText variant="caption" tone="muted">
                      登入後顯示你已報名的課程。
                    </AppText>
                    {login}
                  </>
                )
              }
            />
            <HomeRail
              title="推薦課程"
              courses={recommended}
              seeAll="全部課程"
              onSeeAll={() => router.navigate("/courses")}
              empty={
                <AppText variant="caption" tone="muted">
                  {member ? "目前沒有符合你獎銜、尚未報名的課程。" : "登入後顯示符合你獎銜的課程。"}
                </AppText>
              }
            />
          </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", paddingHorizontal: space.md, overflow: "hidden" },
  inner: { width: "100%", maxWidth: maxContentWidth, gap: space.md, flex: 1 },
  rails: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  middle: { flex: 1, justifyContent: "center", paddingBottom: space.xl },
});
