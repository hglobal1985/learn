import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { useApi } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Select, type SelectOption } from "@/ui";

/** 獎銜選單：與會員中心相同的清單（後端 /admin/central-options 轉接），最前面多一個「不填」。 */
export function useRankOptions(): SelectOption[] {
  const { data } = useApi<{ ranks: { value: string; label: string }[] }>("/admin/central-options");
  return [{ key: "", label: "不填" }, ...(data?.ranks ?? []).map((r) => ({ key: r.value, label: r.label }))];
}

/**
 * 主講人（課程）、分享者（章節）共用的「獎銜＋職稱」兩欄：獎銜是下拉（中央選單），
 * 職稱是自己輸入的文字，輸入時顯示中央詞庫的建議（可點選，也可以自己打，不強迫）。
 * 要改這兩欄的呈現，只改這個檔案，課程與章節兩處一起變。readOnly＝顯示成唯讀（例如勾了「同主講人」）。
 */
export function RankTitleRow({ rank, title, onRank, onTitle, rankOptions, readOnly, who }: { rank: string; title: string; onRank: (v: string) => void; onTitle: (v: string) => void; rankOptions: SelectOption[]; readOnly?: boolean; who: string }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  const [suggest, setSuggest] = useState<string[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    if (!focus || readOnly) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      api<string[]>("GET", `/me/vocab?pool=job_title&q=${encodeURIComponent(title.trim())}`)
        .then((r) => id === seq.current && setSuggest(r.filter((x) => x !== title).slice(0, 8)))
        .catch(() => id === seq.current && setSuggest([]));
    }, 250);
    return () => clearTimeout(t);
  }, [title, focus, readOnly]);
  const rankLabel = rankOptions.find((o) => o.key === rank)?.label ?? (rank || "不填");
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          {readOnly ? (
            <View style={{ gap: 2 }}>
              <AppText variant="caption" tone="muted">
                獎銜
              </AppText>
              <View style={[styles.box, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
                <AppText variant="body" tone="muted" numberOfLines={1}>
                  {rankLabel}
                </AppText>
              </View>
            </View>
          ) : (
            <Select label="獎銜" value={rank} options={rankOptions} onChange={onRank} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">
            職稱
          </AppText>
          {readOnly ? (
            <View style={[styles.box, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
              <AppText variant="body" tone="muted" numberOfLines={1}>
                {title || "（空白）"}
              </AppText>
            </View>
          ) : (
            <TextInput
              value={title}
              onChangeText={(v) => onTitle(v.slice(0, 50))}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 200)}
              placeholder="選填"
              placeholderTextColor={c.textMuted}
              accessibilityLabel={`${who}職稱`}
              style={[styles.box, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
            />
          )}
        </View>
      </View>
      {focus && !readOnly && suggest.length ? (
        <View style={styles.chips}>
          {suggest.map((x) => (
            <Pressable key={x} accessibilityRole="button" accessibilityLabel={`選用職稱 ${x}`} onPress={() => (onTitle(x), setFocus(false))} style={[styles.chip, { backgroundColor: c.accentSoft }]}>
              <AppText variant="callout" style={{ color: c.accentText }}>
                {x}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm, alignItems: "flex-end" },
  box: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: 18, justifyContent: "center" },
});
