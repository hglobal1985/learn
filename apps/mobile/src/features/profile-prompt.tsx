import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { api } from "@/api/client";
import { openAccountCenter } from "@/features/account-link";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Button, Field, Icon, NoticeBox } from "@/ui";

type FieldView = { value: string; pending: string | null; status: string };
type View_ = {
  legalName: string;
  enabled: boolean;
  hglobal: boolean;
  fields: Record<"education_system" | "education_center" | "rank", FieldView>;
  rankOptions: { value: string; label: string }[];
};

/** 文字欄位：輸入時顯示中央的「關聯詞」建議，點一下帶入。儲存統一用視窗最上方的按鈕。 */
function TextRow({ label, value, onChange, pool, pending, allowNone }: { label: string; value: string; onChange: (v: string) => void; pool?: "education_system" | "education_center"; pending?: string | null; allowNone?: boolean }) {
  const { c } = useTheme();
  const none = allowNone && value.trim() === "無";
  const [sugg, setSugg] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const type = (v: string) => {
    onChange(v);
    if (!pool) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api<string[]>("GET", `/me/vocab?pool=${pool}&q=${encodeURIComponent(v)}`)
        .then((s) => setSugg(v.trim() && s.length === 1 && s[0] === v.trim() ? [] : s))
        .catch(() => setSugg([]));
    }, 250);
  };
  return (
    <View style={{ gap: space.xs }}>
      {none ? (
        <View style={{ gap: space.xs }}>
          <AppText variant="callout" tone="muted">
            {label}
          </AppText>
          <View style={[styles.select, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
            <AppText>無（沒有）</AppText>
          </View>
        </View>
      ) : (
        <Field label={label} value={value} onChange={type} />
      )}
      {allowNone ? (
        <Pressable onPress={() => (setSugg([]), onChange(none ? "" : "無"))} accessibilityRole="checkbox" accessibilityState={{ checked: !!none }} style={styles.check}>
          <Icon name={none ? "checkbox" : "square-outline"} size={26} color={none ? c.accentText : c.textMuted} />
          <AppText>我沒有{label}（選「無」）</AppText>
        </Pressable>
      ) : null}
      {!none && sugg.length ? (
        <View style={styles.chips}>
          {sugg.map((s) => (
            <Pressable key={s} onPress={() => (onChange(s), setSugg([]))} accessibilityRole="button" style={styles.chip}>
              <AppText variant="callout">{s}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {pending ? <AppText variant="caption" tone="warning">審核中的新值：{pending}</AppText> : null}
    </View>
  );
}

/**
 * 會員資料未完整時的彈出視窗：蓋在首頁上層，約 73%×80%、內容可上下捲動；「暫時不要」可暫時關閉（下次登入會再提醒）。
 * 最上方置中兩顆同樣式的按鈕並排：「儲存」（一次儲存所有改過的欄位）與「暫時不要」。
 * 欄位：真實姓名、培訓系統、地區教育中心、獎銜；直接用會員本人的身分寫回會員中心（行動大學不保存）。
 * 「我是 Amway 會員」的勾選與同意說明在會員中心，這裡不代為勾選。
 */
export function ProfilePrompt({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const { invalidate } = useSession();
  const [data, setData] = useState<View_ | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState({ legal_name: "", education_system: "", education_center: "", rank: "" });
  const [rankOpen, setRankOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => {
    api<View_>("GET", "/me/central-profile")
      .then((d) => {
        setData(d);
        setVals({ legal_name: d.legalName, education_system: d.fields.education_system.value, education_center: d.fields.education_center.value, rank: d.fields.rank.value });
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const canRank = !!vals.education_system.trim() && !!vals.education_center.trim();
  const rankLabel = (v: string) => data?.rankOptions.find((o) => o.value === v)?.label ?? v;
  const initial = data ? { legal_name: data.legalName, education_system: data.fields.education_system.value, education_center: data.fields.education_center.value, rank: data.fields.rank.value } : null;
  const changed = initial ? (Object.keys(vals) as (keyof typeof vals)[]).filter((k) => (data!.enabled || k === "legal_name") && vals[k].trim() !== initial[k].trim()) : [];
  const save = async () => {
    setBusy(true);
    setMsg(null);
    let pending = false;
    try {
      for (const key of changed) {
        const r = await api<{ status: string | null }>("PUT", "/me/central-profile", { key, value: vals[key] });
        if (r.status === "pending") pending = true;
      }
      setMsg({ ok: true, text: pending ? "已儲存到會員中心，部分欄位等待審核" : "已儲存到會員中心" });
      load();
      invalidate();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border, width: Math.max(260, width * 0.73), maxWidth: 442, maxHeight: height * 0.8 }]}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            <AppText variant="title">先完善資料才能開通權限</AppText>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button label="儲存" icon="save-outline" disabled={busy || !changed.length} loading={busy} onPress={save} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="暫時不要" icon="close" onPress={onClose} fullWidth />
              </View>
            </View>
            {msg ? <NoticeBox tone={msg.ok ? "success" : "danger"} text={msg.text} /> : null}
            {error ? <NoticeBox tone="danger" text={error} /> : null}
            {!data && !error ? <AppText tone="muted">讀取中…</AppText> : null}
            {data ? (
              <>
                <TextRow label="真實姓名（報名課程對帳用）" value={vals.legal_name} onChange={(v) => setVals((s) => ({ ...s, legal_name: v }))} />
                {data.enabled ? (
                  <>
                    <TextRow label="系統" allowNone value={vals.education_system} onChange={(v) => setVals((s) => ({ ...s, education_system: v }))} pool="education_system" pending={data.fields.education_system.pending} />
                    <TextRow label="中心" allowNone value={vals.education_center} onChange={(v) => setVals((s) => ({ ...s, education_center: v }))} pool={data.hglobal ? "education_center" : undefined} pending={data.fields.education_center.pending} />
                    <View style={{ gap: space.xs }}>
                      <AppText variant="callout" tone="muted">
                        獎銜
                      </AppText>
                      <Pressable
                        onPress={() => canRank && setRankOpen(!rankOpen)}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canRank }}
                        style={[styles.select, { borderColor: c.border, backgroundColor: canRank ? c.surface : c.surfaceMuted, opacity: canRank ? 1 : 0.6 }]}
                      >
                        <AppText style={{ flex: 1 }}>{!canRank ? "請先填寫系統與中心" : vals.rank ? rankLabel(vals.rank) : "請選擇獎銜"}</AppText>
                        <Icon name={rankOpen ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
                      </Pressable>
                      {rankOpen ? (
                        <ScrollView style={[styles.list, { borderColor: c.border }]} nestedScrollEnabled>
                          {data.rankOptions.map((o) => (
                            <Pressable key={o.value} onPress={() => (setVals((s) => ({ ...s, rank: o.value })), setRankOpen(false))} accessibilityRole="button" style={[styles.opt, o.value === vals.rank && { backgroundColor: c.accentSoft }]}>
                              <AppText>{o.label}</AppText>
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : null}
                      {data.fields.rank.pending ? <AppText variant="caption" tone="warning">審核中的新值：{rankLabel(data.fields.rank.pending)}</AppText> : null}
                    </View>
                  </>
                ) : (
                  <NoticeBox text="培訓系統、地區教育中心、獎銜屬於「我是 Amway 會員」的資料，請先到會員中心勾選並閱讀同意說明。" />
                )}
              </>
            ) : null}
            <Button label="前往會員中心完善更多資料" variant="ghost" icon="open-outline" onPress={openAccountCenter} fullWidth />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  box: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  close: { position: "absolute", top: 4, right: 4, zIndex: 2, width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  body: { padding: space.lg, gap: space.md },
  actions: { flexDirection: "row", gap: space.sm, alignSelf: "center", width: "100%" },
  check: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: "#e2dfd2", justifyContent: "center" },
  select: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm },
  list: { maxHeight: 220, borderWidth: 1, borderRadius: radius.md },
  opt: { minHeight: 44, paddingHorizontal: space.md, justifyContent: "center" },
});
