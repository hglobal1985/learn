import { useState } from "react";
import { Image, Linking, View } from "react-native";
import { resolveUrl } from "@/api/client";
import { radius, space } from "@/theme/tokens";
import { AppText, Button } from "@/ui";

/** iOS／Android：顯示 EDM，並可用瀏覽器開啟原圖（長按即可儲存）。 */
export function EdmView({ url }: { url: string }) {
  const [ratio, setRatio] = useState(0.7);
  const src = resolveUrl(url);
  return (
    <View style={{ gap: space.sm }}>
      <Image source={{ uri: src }} onLoad={(e) => setRatio(e.nativeEvent.source.width / e.nativeEvent.source.height)} style={{ width: "100%", aspectRatio: ratio, borderRadius: radius.md }} resizeMode="contain" accessibilityLabel="課程海報" />
      <Button variant="secondary" label="開啟原圖（長按可儲存）" icon="download-outline" onPress={() => Linking.openURL(src)} />
      <AppText variant="caption" tone="muted">
        點「開啟原圖」後，長按圖片即可儲存到相簿。
      </AppText>
    </View>
  );
}
