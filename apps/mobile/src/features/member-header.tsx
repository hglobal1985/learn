import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import type { Member } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";
import { AppText } from "@/ui";
import { RankBadge } from "./rank-badge";

const AVATAR = 48; // 大頭照尺寸；徽章在版面上只佔這個高度（上下間距維持原樣）

/**
 * 會員抬頭：大頭照＋姓名＋獎銜標籤。首頁與設定頁最上方共用，格式一致；要改外觀只改這個檔案。
 * 有傳 onPress 才可點（首頁：開啟資料編輯）。
 */
export function MemberHeader({ member, onPress }: { member: Member; onPress?: () => void }) {
  const { c, scheme } = useTheme();
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `${member.name}，完善與編輯會員基本資料` : member.name}
      style={styles.who}
    >
      <View style={styles.left}>
        {member.avatarUrl && !failed ? (
          <Image source={{ uri: member.avatarUrl }} onError={() => setFailed(true)} style={[styles.avatar, { backgroundColor: c.surfaceMuted }]} accessibilityIgnoresInvertColors />
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
        {/* 徽章緊貼在獎銜標籤右邊 */}
        {member.rankBadge ? (
          <View style={{ marginLeft: -space.xs }}>
            <RankBadge url={member.rankBadge} label={member.rankLabel} art={member.rankBadgeArt} layoutHeight={AVATAR} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 56, maxWidth: "100%" },
  left: { flexShrink: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.md, minWidth: 0 },
  rank: { borderWidth: 1, borderColor: "#e6c48c", backgroundColor: "#fdf0e3", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
});
