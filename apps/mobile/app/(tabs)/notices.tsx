import { router } from "expo-router";
import { View } from "react-native";
import { noticesFor } from "@/domain/domain";
import { useStore } from "@/state/store";
import { Button, Card, EmptyState, ListRow, Screen } from "@/ui";

export default function NoticesScreen() {
  const { state, update, unreadCount } = useStore();
  const list = noticesFor(state);
  const markAllRead = () =>
    update((s) => {
      const ids = new Set(noticesFor(s).map((n) => n.id));
      return { ...s, notices: s.notices.map((n) => (ids.has(n.id) ? { ...n, read: true } : n)) };
    });
  return (
    <Screen
      title="站內通知"
      subtitle={state.member ? (unreadCount ? `${unreadCount} 則未讀` : "全部已讀") : undefined}
      right={unreadCount ? <Button variant="ghost" label="全部已讀" onPress={markAllRead} /> : undefined}
    >
      {!state.member ? (
        <EmptyState
          icon="notifications-outline"
          title="尚未登入"
          body="登入後可在這裡收到開課、訂單審核等通知。"
          action={<Button label="前往登入" onPress={() => router.navigate("/me")} />}
        />
      ) : list.length ? (
        <Card style={{ paddingVertical: 0 }}>
          <View>
            {list.map((n) => (
              <ListRow
                key={n.id}
                icon={n.read ? "mail-open-outline" : "mail-unread-outline"}
                title={n.title}
                subtitle={n.body}
                unread={!n.read}
                onPress={() =>
                  update((s) => ({ ...s, notices: s.notices.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }))
                }
              />
            ))}
          </View>
        </Card>
      ) : (
        <EmptyState icon="notifications-outline" title="目前沒有通知" body="領取課程或訂單有進度時，會在這裡通知你。" />
      )}
    </Screen>
  );
}
