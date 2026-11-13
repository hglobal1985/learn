import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { api, type Notice } from "@/api/client";
import { dateTime, noticeTarget } from "@/features/format";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { Button, Card, EmptyState, ErrorView, ListRow, LoadingView, Screen } from "@/ui";

export default function NoticesScreen() {
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const { data, error, loading, reload } = useApi<Notice[]>(member ? "/notifications" : null);
  const unread = (data ?? []).filter((n) => !n.read).length;
  const open = async (n: Notice) => {
    if (!n.read) await api("POST", `/notifications/${n.id}/read`).catch(() => undefined);
    invalidate();
    router.push(noticeTarget(n.link) as Href);
  };
  const markAll = async () => {
    await api("POST", "/notifications/read-all").catch(() => undefined);
    invalidate();
  };
  if (!member)
    return (
      <Screen title="站內通知">
        <EmptyState
          icon="notifications-outline"
          title="尚未登入"
          body="登入後可在這裡收到開課、報名審核等通知。"
          action={<Button label="前往登入" onPress={() => router.navigate("/me")} />}
        />
      </Screen>
    );
  return (
    <Screen
      title="站內通知"
      subtitle={data ? (unread ? `${unread} 則未讀` : "全部已讀") : undefined}
      right={
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {unread ? <Button variant="ghost" label="全部標為已讀" onPress={markAll} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="通知設定" onPress={() => router.push("/settings/notifications")} hitSlop={8} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="settings-outline" size={26} color={c.text} />
          </Pressable>
        </View>
      }
    >
      {error && !data ? <ErrorView message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingView /> : null}
      {data && !data.length ? <EmptyState icon="notifications-outline" title="目前沒有通知" body="報名課程或報名有進度時，會在這裡通知你。" /> : null}
      {data?.length ? (
        <Card style={{ paddingVertical: 0 }}>
          {data.map((n) => (
            <ListRow
              key={n.id}
              icon={n.read ? "mail-open-outline" : "mail-unread-outline"}
              title={n.title}
              subtitle={`${n.body}${n.body ? "\n" : ""}${dateTime(n.createdAt)}`}
              unread={!n.read}
              onPress={() => open(n)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
