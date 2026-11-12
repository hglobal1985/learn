import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, type HostInstance, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { api } from "@/api/client";
import { openAccountCenter } from "@/features/account-link";
import { useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Icon, type IconName } from "@/ui";

type FieldView = { value: string; pending: string | null; status: string };
type View_ = {
  legalName: string;
  nickname: string;
  email: string;
  enabled: boolean;
  hglobal: boolean;
  fields: Record<"education_system" | "education_center" | "rank", FieldView>;
  rankOptions: { value: string; label: string }[];
};

const FIELD_H = 44;
/** 欄位要顯示的內容：有等待審核的新值就顯示新值（使用者剛填的），沒有才顯示目前生效的值。 */
const shown = (f: { value: string; pending: string | null }) => f.pending ?? f.value;
const PENDING_TEXT = "（等待中心管理員審核）";

/** 欄位標籤；等待審核的欄位在後面加上醒目的橘色說明。 */
function Label({ text, pending }: { text: string; pending?: boolean }) {
  const { c } = useTheme();
  return (
    <AppText variant="caption" tone="muted" numberOfLines={1}>
      {text}
      {pending ? <Text style={{ color: c.warning, fontWeight: "800" }}>{PENDING_TEXT}</Text> : null}
    </AppText>
  );
}

/** 單行輸入框（樣式與 Field 相同，但不含上方標籤，方便跟「無」勾選框排在同一列）。 */
function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  return <TextInput value={value} onChangeText={onChange} autoCapitalize="none" style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]} />;
}

/** 與中央會員相同的「無」勾選框：只寫一個字「無」，排在輸入框右邊。 */
function NoneBox({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel="無" style={styles.none}>
      <Icon name={on ? "checkbox" : "square-outline"} size={30} color={on ? c.accentText : c.textMuted} />
      <AppText style={{ fontWeight: "700" }}>無</AppText>
    </Pressable>
  );
}

/** 文字欄位：標籤在上，輸入框＋「無」在同一列；輸入時顯示中央的「關聯詞」建議（單行橫向滑動），點一下帶入。 */
function TextRow({ label, value, onChange, pool, pending, allowNone }: { label: string; value: string; onChange: (v: string) => void; pool?: "education_system" | "education_center"; pending?: boolean; allowNone?: boolean }) {
  const { c } = useTheme();
  const [sugg, setSugg] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const none = !!allowNone && value.trim() === "無";
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
    <View style={{ gap: 2 }}>
      <Label text={label} pending={pending} />
      <View style={styles.line}>
        <View style={{ flex: 1 }}>
          {none ? (
            <View style={[styles.input, { borderColor: c.border, backgroundColor: c.surfaceMuted, justifyContent: "center" }]}>
              <AppText tone="muted">無</AppText>
            </View>
          ) : (
            <Input value={value} onChange={type} />
          )}
        </View>
        {allowNone ? <NoneBox on={none} onToggle={() => (setSugg([]), onChange(none ? "" : "無"))} /> : null}
      </View>
      {!none && sugg.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
          {sugg.map((s) => (
            <Pressable key={s} onPress={() => (onChange(s), setSugg([]))} accessibilityRole="button" style={styles.chip}>
              <AppText variant="callout" numberOfLines={1}>
                {s}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** 視窗頂端的按鈕：文字一律單行、不換行。儲存與暫時不要用同一個樣式。 */
function Btn({ label, icon, onPress, disabled, loading }: { label: string; icon: IconName; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={[styles.btn, { backgroundColor: c.accent, opacity: disabled && !loading ? 0.45 : 1 }]}>
      {loading ? <ActivityIndicator size="small" color={c.textOnAccent} /> : <Icon name={icon} size={20} color={c.textOnAccent} />}
      <Text numberOfLines={1} style={{ color: c.textOnAccent, fontSize: 16, fontWeight: "700" }}>
        {loading ? "儲存中" : label}
      </Text>
    </Pressable>
  );
}

/**
 * 會員資料未完整時的彈出視窗：蓋在首頁上層、內容壓縮在一個畫面內（沒有上下捲動）。
 * 最上方並排「儲存」與「暫時不要」（同樣式、文字單行）；欄位：真實姓名、系統、中心、獎銜，
 * 系統／中心／獎銜右邊都有與中央會員相同的「無」勾選框；獎銜需先有系統與中心。
 * 直接用會員本人的身分寫回會員中心（行動大學不保存）。「我是 Amway 會員」的勾選與同意說明在會員中心，這裡不代為勾選。
 */
export function ProfilePrompt({ onClose, initial: first }: { onClose: () => void; initial?: View_ | null }) {
  const { c } = useTheme();
  const { width, height: winHeight } = useWindowDimensions();
  const { invalidate } = useSession();
  const [data, setData] = useState<View_ | null>(first ?? null);
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState({ legal_name: "", display_name: "", contact_email: "", education_system: "", education_center: "", rank: "" });
  const [rankOpen, setRankOpen] = useState(false);
  // 獎銜下拉選單：依螢幕剩餘空間自動往下或往上展開，高度也隨剩餘空間調整（不會貼到螢幕邊緣）。
  const rankBox = useRef<HostInstance>(null);
  const [drop, setDrop] = useState({ up: false, max: 220 });
  const toggleRank = () => {
    if (rankOpen) return setRankOpen(false);
    rankBox.current?.measureInWindow((_x, y, _w, h) => {
      const below = winHeight - (y + h) - 24;
      const above = y - 24;
      const up = below < 220 && above > below;
      setDrop({ up, max: Math.max(120, Math.min(280, up ? above : below)) });
      setRankOpen(true);
    });
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const apply = useCallback((d: View_) => {
    setData(d);
    setVals({ legal_name: d.legalName, display_name: d.nickname, contact_email: d.email, education_system: shown(d.fields.education_system), education_center: shown(d.fields.education_center), rank: shown(d.fields.rank) });
    setError(null);
  }, []);
  const load = useCallback(() => {
    api<View_>("GET", "/me/central-profile")
      .then(apply)
      .catch((e: Error) => setError(e.message));
  }, [apply]);
  useEffect(() => {
    // 開啟時如果首頁已經把資料帶來了，就直接用（不用再等一次網路）；否則才向伺服器要。
    if (first) setVals({ legal_name: first.legalName, display_name: first.nickname, contact_email: first.email, education_system: shown(first.fields.education_system), education_center: shown(first.fields.education_center), rank: shown(first.fields.rank) });
    else load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  const canRank = !!vals.education_system.trim() && !!vals.education_center.trim();
  const rankNone = vals.rank === "none";
  const rankLabel = (v: string) => data?.rankOptions.find((o) => o.value === v)?.label ?? v;
  const initial = data ? { legal_name: data.legalName, display_name: data.nickname, contact_email: data.email, education_system: shown(data.fields.education_system), education_center: shown(data.fields.education_center), rank: shown(data.fields.rank) } : null;
  const changed = initial ? (Object.keys(vals) as (keyof typeof vals)[]).filter((k) => (data!.enabled || k === "legal_name" || k === "display_name" || k === "contact_email") && vals[k].trim() !== initial[k].trim()) : [];
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // 所有改過的欄位一次送出（伺服器同時寫給會員中心），並把最新狀態一起帶回來，不用再多問一趟。
      const r = await api<{ ok: boolean; errors: string[]; pending: boolean; form: View_ | null }>("PUT", "/me/central-profile", { changes: changed.map((key) => ({ key, value: vals[key] })) });
      if (r.form) apply(r.form);
      else load();
      setMsg(r.errors.length ? { ok: false, text: r.errors[0] } : { ok: true, text: r.pending ? "已儲存，部分欄位等待審核" : "已儲存到會員中心" });
      invalidate();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} accessibilityViewIsModal>
      {/* 鍵盤打開時畫面可視高度會變矮：視窗本身維持原本大小，不跟著縮短；放不下時整個視窗可以一起上下拉動。 */}
      <ScrollView style={styles.backdrop} contentContainerStyle={styles.backdropInner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border, width: Math.max(260, width * 0.73), maxWidth: 442 }]}>
          <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 0 }}>
            資料需完整 才可瀏覽課程
          </AppText>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Btn label="儲存" icon="save-outline" onPress={save} disabled={busy || !changed.length} loading={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="關閉" icon="close" onPress={onClose} />
            </View>
          </View>
          {msg ? (
            <AppText variant="caption" tone={msg.ok ? "success" : "danger"} numberOfLines={2}>
              {msg.text}
            </AppText>
          ) : null}
          {error ? (
            <AppText variant="caption" tone="danger" numberOfLines={2}>
              {error}
            </AppText>
          ) : null}
          {!data && !error ? <AppText tone="muted">讀取中…</AppText> : null}
          {data ? (
            <>
              <View style={styles.line}>
                <View style={{ flex: 1 }}>
                  <TextRow label="真實姓名" value={vals.legal_name} onChange={(v) => setVals((s) => ({ ...s, legal_name: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextRow label="暱稱" value={vals.display_name} onChange={(v) => setVals((s) => ({ ...s, display_name: v }))} />
                </View>
              </View>
              <TextRow label="Email" value={vals.contact_email} onChange={(v) => setVals((s) => ({ ...s, contact_email: v }))} />
              {data.enabled ? (
                <>
                  <TextRow label="系統" allowNone value={vals.education_system} onChange={(v) => setVals((s) => ({ ...s, education_system: v }))} pool="education_system" pending={data.fields.education_system.pending !== null} />
                  <TextRow label="中心" allowNone value={vals.education_center} onChange={(v) => setVals((s) => ({ ...s, education_center: v }))} pool={data.hglobal ? "education_center" : undefined} pending={data.fields.education_center.pending !== null} />
                  <View style={{ gap: 2, zIndex: 5 }}>
                    <Label text="獎銜" pending={data.fields.rank.pending !== null} />
                    <View style={styles.line}>
                      <View ref={rankBox} collapsable={false} style={{ flex: 1 }}>
                        <Pressable
                          onPress={() => canRank && !rankNone && toggleRank()}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: !canRank }}
                          style={[styles.input, { borderColor: c.border, backgroundColor: canRank && !rankNone ? c.surface : c.surfaceMuted, flexDirection: "row", alignItems: "center", gap: space.sm }]}
                        >
                          <AppText style={{ flex: 1 }} numberOfLines={1} tone={canRank && !rankNone ? undefined : "muted"}>
                            {!canRank ? "請先填系統與中心" : rankNone ? "無" : vals.rank ? rankLabel(vals.rank) : "請選擇"}
                          </AppText>
                          <Icon name={rankOpen ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
                        </Pressable>
                        {rankOpen ? (
                          <ScrollView style={[styles.dropdown, drop.up ? { bottom: FIELD_H + 4 } : { top: FIELD_H + 4 }, { maxHeight: drop.max, borderColor: c.border, backgroundColor: c.surface }]} nestedScrollEnabled>
                            {data.rankOptions
                              .filter((o) => o.value !== "none")
                              .map((o) => (
                                <Pressable key={o.value} onPress={() => (setVals((s) => ({ ...s, rank: o.value })), setRankOpen(false))} accessibilityRole="button" style={[styles.opt, o.value === vals.rank && { backgroundColor: c.accentSoft }]}>
                                  <AppText numberOfLines={1}>{o.label}</AppText>
                                </Pressable>
                              ))}
                          </ScrollView>
                        ) : null}
                      </View>
                      <NoneBox
                        on={rankNone}
                        onToggle={() => {
                          if (!canRank) return;
                          setRankOpen(false);
                          setVals((s) => ({ ...s, rank: rankNone ? "" : "none" }));
                        }}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <AppText variant="caption" tone="muted" numberOfLines={3}>
                  系統、中心、獎銜屬於「我是 Amway 會員」的資料，請先到會員中心勾選。
                </AppText>
              )}
            </>
          ) : null}
          <Pressable onPress={openAccountCenter} accessibilityRole="link" style={styles.more}>
            <Icon name="open-outline" size={18} color={c.accentText} />
            <Text numberOfLines={1} style={{ color: c.accentText, fontSize: 14, fontWeight: "700", flexShrink: 1 }}>
              前往會員中心完善更多資料
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  backdropInner: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 24 },
  box: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.sm },
  actions: { flexDirection: "row", gap: space.sm, width: "100%" },
  btn: { minHeight: 44, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: space.sm },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: { minHeight: FIELD_H, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  none: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, minWidth: 60 },
  chips: { flexDirection: "row", gap: space.xs, paddingVertical: 2 },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: "#e2dfd2", justifyContent: "center" },
  dropdown: { position: "absolute", left: 0, right: 0, borderWidth: 1, borderRadius: radius.md, zIndex: 20 },
  opt: { minHeight: 44, paddingHorizontal: space.md, justifyContent: "center" },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 36 },
});
