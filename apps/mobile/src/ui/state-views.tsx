import { ActivityIndicator, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

export function LoadingView() {
  const { c } = useTheme();
  return (
    <View style={{ padding: space.xxl, alignItems: "center" }} accessibilityLabel="載入中">
      <ActivityIndicator color={c.accentText} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="暫時無法載入"
      body={message}
      action={onRetry ? <Button variant="secondary" label="重新整理" icon="refresh" onPress={onRetry} /> : undefined}
    />
  );
}
