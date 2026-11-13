import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { api, RIBBON_INFO, RIBBON_KEYS, RIBBON_PALETTE, SORT_GROUP_INFO, type RibbonKey, type UiConfig } from "@/api/client";
import { RIBBON_COLORS } from "@/features/courses/ribbons";
import { useSession } from "@/state/session";
import { useUiConfig } from "@/state/ui-config";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space } from "@/theme/tokens";
import { AppText, Button, Card, EmptyState, Field, NoticeBox, Screen, Section } from "@/ui";

/** 緞帶小預覽：一條橫的色帶，顯示目前的文字與顏色。 */
function Sample({ label, color }: { label: string; color: keyof typeof RIBBON_COLORS }) {
  const c = RIBBON_COLORS[color];
  return (
    <View style={[styles.sample, { backgroundColor: c.bg }]}>
      <AppText variant="caption" style={{ color: c.fg, fontWeight: "800", letterSpacing: 1 }} numberOfLines={1}>
        {label || "（沒有文字）"}
      </AppText>
    </View>
  );
}

/**
 * 超級管理員：「課程排序與條件」——
 * ① 全部課程的排序優先順位（上下移動）；② 每種狀態緞帶的顯示文字、顏色（只能選規範色）、要不要顯示。
 */
export default function ListRulesScreen() {
  const { c } = useTheme();
  const { member } = useSession();
  const { config, reload } = useUiConfig();
  const [cfg, setCfg] = useState<UiConfig>(config);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  useEffect(() => setCfg(config), [config]);
  if (!member?.titles.includes("超級管理員")) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="只有超級管理員可以設定" /></Screen>;

  const move = (i: number, d: -1 | 1) =>
    setCfg((x) => {
      const g = [...x.sortGroups];
      const j = i + d;
      if (j < 0 || j >= g.length) return x;
      [g[i], g[j]] = [g[j]!, g[i]!];
      return { ...x, sortGroups: g };
    });
  const setRibbon = (k: RibbonKey, patch: Partial<UiConfig["ribbons"][RibbonKey]>) => setCfg((x) => ({ ...x, ribbons: { ...x.ribbons, [k]: { ...x.ribbons[k], ...patch } } }));
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("PUT", "/admin/ui-config", { sortGroups: cfg.sortGroups, ribbons: cfg.ribbons });
      reload();
      setMsg({ tone: "success", text: "已儲存，全部課程馬上套用。" });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const ribbonCard = (k: RibbonKey) => {
    const r = cfg.ribbons[k];
    return (
      <Card key={k}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppText variant="headline">{RIBBON_INFO[k].title}</AppText>
            <AppText variant="caption" tone="muted">
              {RIBBON_INFO[k].hint}
            </AppText>
          </View>
          <Switch value={r.enabled} onValueChange={(v) => setRibbon(k, { enabled: v })} trackColor={{ false: c.border, true: c.accent }} accessibilityLabel={`${RIBBON_INFO[k].title}顯示開關`} />
        </View>
        <Field label={k === "countdown" ? "顯示文字（{n} 會換成天數）" : "顯示文字"} value={r.label} onChange={(v) => setRibbon(k, { label: v })} />
        <AppText variant="callout" tone="muted">
          顏色（只能選寰宇規範色）：{RIBBON_COLORS[r.color].name}
        </AppText>
        <View style={styles.swatches}>
          {RIBBON_PALETTE.map((p) => (
            <Pressable key={p} accessibilityRole="button" accessibilityLabel={RIBBON_COLORS[p].name} accessibilityState={{ selected: r.color === p }} onPress={() => setRibbon(k, { color: p })} style={[styles.swatch, { backgroundColor: RIBBON_COLORS[p].bg, borderColor: r.color === p ? c.text : c.border, borderWidth: r.color === p ? 3 : 1 }]}>
              {r.color === p ? <Ionicons name="checkmark" size={20} color={RIBBON_COLORS[p].fg} /> : null}
            </Pressable>
          ))}
        </View>
        <Sample label={r.label.replace("{n}", "12")} color={r.color} />
      </Card>
    );
  };

  return (
    <Screen header={false}>
      <AppText variant="callout" tone="muted">
        調整「全部課程」的排序與卡片緞帶。緞帶顏色只能從寰宇生態系固定色表挑選。
      </AppText>
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}

      <Section title="① 排序優先順位（由上到下）">
        <Card style={{ paddingVertical: 0 }}>
          {cfg.sortGroups.map((g, i) => (
            <View key={g} style={[styles.sortRow, { borderBottomColor: c.border }]}>
              <View style={[styles.num, { backgroundColor: c.accentSoft }]}>
                <AppText variant="callout" style={{ color: c.accentText, fontWeight: "700" }}>
                  {i + 1}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="headline">{SORT_GROUP_INFO[g].title}</AppText>
                <AppText variant="caption" tone="muted">
                  {SORT_GROUP_INFO[g].hint}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="往上移" disabled={i === 0} onPress={() => move(i, -1)} style={[styles.arrow, { opacity: i === 0 ? 0.3 : 1 }]}>
                <Ionicons name="arrow-up" size={22} color={c.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="往下移" disabled={i === cfg.sortGroups.length - 1} onPress={() => move(i, 1)} style={[styles.arrow, { opacity: i === cfg.sortGroups.length - 1 ? 0.3 : 1 }]}>
                <Ionicons name="arrow-down" size={22} color={c.text} />
              </Pressable>
            </View>
          ))}
        </Card>
        <AppText variant="caption" tone="muted">
          同一組內：還沒開課的依日期由近到遠，已開課（或沒有日期）的依日期由新到舊。
        </AppText>
      </Section>

      <Section title="② 左上角緞帶（資格或狀態）">{RIBBON_KEYS.filter((k) => RIBBON_INFO[k].side === "left").map(ribbonCard)}</Section>
      <Section title="③ 右上角緞帶（日期）">{RIBBON_KEYS.filter((k) => RIBBON_INFO[k].side === "right").map(ribbonCard)}</Section>

      <View style={styles.row}>
        <Button label="儲存" icon="save-outline" loading={busy} disabled={busy} onPress={save} />
        <Button variant="ghost" label="還原目前設定" disabled={busy} onPress={() => setCfg(config)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  sortRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  arrow: { width: minTouch - 4, height: minTouch, alignItems: "center", justifyContent: "center" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sample: { alignSelf: "flex-start", paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.sm },
});
