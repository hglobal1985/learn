import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api, type CourseComment } from "@/api/client";
import { dateTime } from "@/features/format";
import { useApi, useSession } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, ErrorView, LoadingView, Pill, Screen } from "@/ui";

/** 管理員：被檢舉或已隱藏的留言。 */
export default function AdminCommentsScreen() {
  const { member, invalidate } = useSession();
  const isAdmin = member?.role === "admin";
  const { data, error, reload } = useApi<CourseComment[]>(isAdmin ? "/admin/comments" : null);
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要管理員權限" /></Screen>;
  if (!data) return <Screen header={false}>{error ? <ErrorView message={error} onRetry={reload} /> : <LoadingView />}</Screen>;
  const act = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    await api("PATCH", `/admin/comments/${id}`, body).catch(() => undefined);
    setBusy(false);
    invalidate();
  };
  return (
    <Screen header={false}>
      {!data.length ? <EmptyState icon="checkmark-done-outline" title="沒有待處理的檢舉" /> : null}
      {data.map((c) => (
        <Card key={c.id}>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap", alignItems: "center" }}>
            <AppText variant="headline" style={{ flex: 1 }}>
              {c.authorName}
            </AppText>
            {c.reports ? <Pill label={`被檢舉 ${c.reports} 次`} tone="warning" /> : null}
            {c.hidden ? <Pill label="已隱藏" tone="danger" /> : null}
          </View>
          <AppText variant="caption" tone="muted">
            {c.courseTitle} · {dateTime(c.createdAt)}
          </AppText>
          <AppText>{c.body}</AppText>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Button variant={c.hidden ? "secondary" : "danger"} label={c.hidden ? "取消隱藏" : "隱藏留言"} disabled={busy} onPress={() => act(c.id, { hidden: !c.hidden })} />
            {c.reports ? <Button variant="secondary" label="沒有問題，清除檢舉" disabled={busy} onPress={() => act(c.id, { dismiss: true })} /> : null}
            <Button variant="ghost" label="前往課程" onPress={() => router.push(`/course/${c.courseId}`)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
