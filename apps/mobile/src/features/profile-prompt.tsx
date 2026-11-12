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
  hglobalSystems: string[];
  fields: Record<"education_system" | "education_center" | "rank", FieldView>;
  rankOptions: { value: string; label: string }[];
};
type Key = "legal_name" | "display_name" | "contact_email" | "education_system" | "education_center" | "rank";

const FIELD_H = 44;
const OTHER = "__other";
const NONE_TERM = "無";
const PENDING_TEXT = "（等待中心管理員審核）";
/** 欄位要顯示的內容：有等待審核的新值就顯示新值（使用者剛填的），沒有才顯示目前生效的值。 */
const shown = (f: { value: string; pending: string | null }) => f.pending ?? f.value;
const formVals = (d: View_): Record<Key, string> => ({ legal_name: d.legalName, display_name: d.nickname, contact_email: d.email, education_system: shown(d.fields.education_system), education_center: shown(d.fields.education_center), rank: shown(d.fields.rank) });
const norm = (s: string) => s.trim().toLowerCase();

/** 欄位標籤：必填欄位旁有橘色「必填」小標籤（中央視覺規範）；等待審核的欄位加上醒目的橘色說明。 */
function Label({ text, pending, required }: { text: string; pending?: boolean; required?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={styles.labelRow}>
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
        {pending ? <Text style={{ color: c.warning, fontWeight: "800" }}>{PENDING_TEXT}</Text> : null}
      </AppText>
      {required ? (
        <View style={[styles.req, { backgroundColor: c.warningSoft, borderColor: c.warning }]}>
          <Text style={{ color: c.warning, fontSize: 12, fontWeight: "800" }}>必填</Text>
        </View>
      ) : null}
    </View>
  );
}

/** 必填沒填時，整列用 2px 橘框＋淡橘底標示（中央視覺規範）。 */
function Row({ bad, z, children }: { bad?: boolean; z?: number; children: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={[{ gap: 2, zIndex: z ?? 1 }, bad && { borderWidth: 2, borderColor: c.warning, backgroundColor: c.warningSoft, borderRadius: radius.md, padding: 4 }]}>{children}</View>;
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { c } = useTheme();
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.textMuted} autoCapitalize="none" style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]} />;
}

/** 與中央會員相同的「無」勾選框：只寫一個字「無」，排在輸入框／下拉選單右邊。 */
function NoneBox({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onToggle} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }} accessibilityLabel="無" style={[styles.none, { opacity: disabled ? 0.45 : 1 }]}>
      <Icon name={on ? "checkbox" : "square-outline"} size={30} color={on ? c.accentText : c.textMuted} />
      <AppText style={{ fontWeight: "700" }}>無</AppText>
    </Pressable>
  );
}

/**
 * 自訂下拉選單（不用系統原生選單）：依螢幕剩餘空間自動往下或往上展開；選項超過 12 個時上方有搜尋框。
 */
function Dropdown({ options, value, label, disabled, onPick }: { options: { value: string; label: string }[]; value: string; label: string; disabled?: boolean; onPick: (v: string) => void }) {
  const { c } = useTheme();
  const { height: winH } = useWindowDimensions();
  const box = useRef<HostInstance>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ up: false, max: 240 });
  const toggle = () => {
    if (open) return setOpen(false);
    box.current?.measureInWindow((_x, y, _w, h) => {
      const below = winH - (y + h) - 24;
      const above = y - 24;
      const up = below < 240 && above > below;
      setPos({ up, max: Math.max(140, Math.min(300, up ? above : below)) });
      setQ("");
      setOpen(true);
    });
  };
  const list = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  return (
    <View ref={box} collapsable={false} style={{ flex: 1, zIndex: open ? 50 : 1 }}>
      <Pressable onPress={() => !disabled && toggle()} accessibilityRole="button" accessibilityState={{ disabled: !!disabled, expanded: open }} style={[styles.input, { borderColor: c.border, backgroundColor: disabled ? c.surfaceMuted : c.surface, flexDirection: "row", alignItems: "center", gap: space.sm, opacity: disabled ? 0.7 : 1 }]}>
        <AppText style={{ flex: 1 }} numberOfLines={1} tone={disabled || !value ? "muted" : undefined}>
          {label}
        </AppText>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
      </Pressable>
      {open ? (
        <View style={[styles.dropdown, pos.up ? { bottom: FIELD_H + 4 } : { top: FIELD_H + 4 }, { maxHeight: pos.max, borderColor: c.border, backgroundColor: c.surface }]}>
          {options.length > 12 ? (
            <TextInput value={q} onChangeText={setQ} placeholder="搜尋" placeholderTextColor={c.textMuted} autoCapitalize="none" style={[styles.search, { color: c.text, borderColor: c.border }]} />
          ) : null}
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {list.map((o) => (
              <Pressable key={o.value} onPress={() => (onPick(o.value), setOpen(false))} accessibilityRole="button" style={[styles.opt, o.value === value && { backgroundColor: c.accentSoft }]}>
                <AppText numberOfLines={1}>{o.label}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** 視窗頂端的按鈕：文字一律單行。儲存＝金黃色（中央視覺規範），儲存中顯示轉圈圈與「儲存中」。 */
function Btn({ label, icon, onPress, disabled, loading, save }: { label: string; icon: IconName; onPress: () => void; disabled?: boolean; loading?: boolean; save?: boolean }) {
  const { c, scheme } = useTheme();
  const fg = save ? (scheme === "dark" ? "#172016" : "#1d2a22") : c.textOnAccent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.btn, save ? { backgroundColor: "#f2dc27", borderWidth: 2, borderColor: scheme === "dark" ? "#6b5424" : "#e6c48c" } : { backgroundColor: c.accent }, { opacity: disabled && !loading ? 0.45 : 1 }]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : <Icon name={icon} size={20} color={fg} />}
      <Text numberOfLines={1} style={{ color: fg, fontSize: 16, fontWeight: "700" }}>
        {loading ? "儲存中" : label}
      </Text>
    </Pressable>
  );
}

/**
 * 「資料需完整 才可瀏覽課程」視窗：蓋在首頁上層，內容壓縮在一個畫面內。
 * 欄位規則依中央會員最新版（串接指令 2026-11-13.9）：
 * 暱稱必填；勾選「我是 Amway 會員」後系統、中心、獎銜必填（可勾「無」）；獎銜需先有系統與中心；
 * 系統是清單選單＋「其他」自訂；中心在所選系統是寰宇時是清單選單＋「其他」，否則是一般輸入框；
 * 必填沒填時標示橘框，不送出。直接用會員本人的身分寫回會員中心（行動大學不保存）。
 */
export function ProfilePrompt({ onClose, initial: first }: { onClose: () => void; initial?: View_ | null }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { invalidate } = useSession();
  const [data, setData] = useState<View_ | null>(first ?? null);
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<Key, string>>({ legal_name: "", display_name: "", contact_email: "", education_system: "", education_center: "", rank: "" });
  const [terms, setTerms] = useState<{ education_system: string[]; education_center: string[] }>({ education_system: [], education_center: [] });
  const [otherPick, setOtherPick] = useState<{ education_system?: boolean; education_center?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [showBad, setShowBad] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: Key) => (v: string) => setVals((s) => ({ ...s, [k]: v }));

  const apply = useCallback((d: View_) => {
    setData(d);
    setVals(formVals(d));
    setOtherPick({});
    setError(null);
  }, []);
  const load = useCallback(() => {
    api<View_>("GET", "/me/central-profile")
      .then(apply)
      .catch((e: Error) => setError(e.message));
  }, [apply]);
  useEffect(() => {
    // 開啟時如果首頁已經把資料帶來了，就直接用（不用再等一次網路）；否則才向伺服器要。
    if (first) setVals(formVals(first));
    else load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  // 系統、中心的清單（中央的關聯詞庫，空字串＝整份清單）。
  useEffect(() => {
    if (!data?.enabled) return;
    for (const pool of ["education_system", "education_center"] as const)
      api<string[]>("GET", `/me/vocab?pool=${pool}&q=`)
        .then((s) => setTerms((t) => ({ ...t, [pool]: s })))
        .catch(() => undefined);
  }, [data?.enabled]);

  const initial = data ? formVals(data) : null;
  const changed = initial ? (Object.keys(vals) as Key[]).filter((k) => (data!.enabled || k === "legal_name" || k === "display_name" || k === "contact_email") && vals[k].trim() !== initial[k].trim()) : [];
  const canRank = !!vals.education_system.trim() && !!vals.education_center.trim();
  const rankNone = vals.rank === "none";
  const rankLabel = (v: string) => data?.rankOptions.find((o) => o.value === v)?.label ?? v;
  /** 目前（還沒儲存）選的系統是不是寰宇：沒選就看中央判斷的整體狀態。 */
  const systemHg = data ? (vals.education_system.trim() && vals.education_system !== NONE_TERM ? data.hglobalSystems.some((t) => norm(t) === norm(vals.education_system)) : data.hglobal) : false;
  const centerListed = systemHg && terms.education_center.length > 0 && vals.education_center !== undefined;
  const missing: Key[] = data ? ([!vals.display_name.trim() && "display_name", data.enabled && !vals.education_system.trim() && "education_system", data.enabled && !vals.education_center.trim() && "education_center", data.enabled && !vals.rank.trim() && "rank"].filter(Boolean) as Key[]) : [];

  const save = async () => {
    if (missing.length) {
      setShowBad(true);
      setMsg({ ok: false, text: "還有標示「必填」的欄位沒填" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      // 所有改過的欄位一次送出（伺服器同時寫給會員中心），並把最新狀態一起帶回來。
      const r = await api<{ ok: boolean; errors: string[]; pending: boolean; form: View_ | null }>("PUT", "/me/central-profile", { changes: changed.map((key) => ({ key, value: vals[key] })) });
      if (r.form) apply(r.form);
      else load();
      setShowBad(false);
      setMsg(r.errors.length ? { ok: false, text: r.errors[0] } : { ok: true, text: r.pending ? "已儲存，部分欄位等待審核" : "已儲存到會員中心" });
      invalidate();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  /** 系統／中心：清單選單＋「其他」自訂輸入＋右邊的「無」勾選框。 */
  const listedRow = (key: "education_system" | "education_center", label: string, pendingNew: boolean) => {
    const v = vals[key];
    const none = v.trim() === NONE_TERM;
    const list = terms[key];
    const other = !none && (otherPick[key] ?? (!!v.trim() && !list.includes(v)));
    const sel = none ? "" : other ? OTHER : v;
    const options = [{ value: "", label: "（未選擇）" }, ...list.map((t) => ({ value: t, label: t })), { value: OTHER, label: "其他" }];
    return (
      <Row z={key === "education_system" ? 30 : 20} bad={showBad && missing.includes(key)}>
        <Label text={label} pending={pendingNew} required />
        <View style={styles.line}>
          <Dropdown
            options={options}
            value={sel}
            label={none ? "無" : other ? "其他" : v || "（未選擇）"}
            disabled={none}
            onPick={(p) => {
              if (p === OTHER) {
                setOtherPick((s) => ({ ...s, [key]: true }));
                set(key)("");
              } else {
                setOtherPick((s) => ({ ...s, [key]: false }));
                set(key)(p);
              }
            }}
          />
          <NoneBox on={none} onToggle={() => (setOtherPick((s) => ({ ...s, [key]: false })), set(key)(none ? "" : NONE_TERM))} />
        </View>
        {other ? <Input value={v} onChange={set(key)} placeholder="請輸入自訂內容" /> : null}
      </Row>
    );
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
              <Btn save label="儲存" icon="save-outline" onPress={save} disabled={busy || !changed.length} loading={busy} />
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
                  <Row>
                    <Label text="真實姓名" />
                    <Input value={vals.legal_name} onChange={set("legal_name")} />
                  </Row>
                </View>
                <View style={{ flex: 1 }}>
                  <Row bad={showBad && missing.includes("display_name")}>
                    <Label text="暱稱" required />
                    <Input value={vals.display_name} onChange={set("display_name")} />
                  </Row>
                </View>
              </View>
              <Row>
                <Label text="Email" />
                <Input value={vals.contact_email} onChange={set("contact_email")} />
              </Row>
              {data.enabled ? (
                <>
                  {listedRow("education_system", "系統", data.fields.education_system.pending !== null)}
                  {centerListed ? (
                    listedRow("education_center", "中心", data.fields.education_center.pending !== null)
                  ) : (
                    <Row z={20} bad={showBad && missing.includes("education_center")}>
                      <Label text="中心" pending={data.fields.education_center.pending !== null} required />
                      <View style={styles.line}>
                        <View style={{ flex: 1 }}>
                          {vals.education_center.trim() === NONE_TERM ? (
                            <View style={[styles.input, { borderColor: c.border, backgroundColor: c.surfaceMuted, justifyContent: "center" }]}>
                              <AppText tone="muted">無</AppText>
                            </View>
                          ) : (
                            <Input value={vals.education_center} onChange={set("education_center")} />
                          )}
                        </View>
                        <NoneBox on={vals.education_center.trim() === NONE_TERM} onToggle={() => set("education_center")(vals.education_center.trim() === NONE_TERM ? "" : NONE_TERM)} />
                      </View>
                    </Row>
                  )}
                  <Row z={10} bad={showBad && missing.includes("rank")}>
                    <Label text="獎銜" pending={data.fields.rank.pending !== null} required />
                    <View style={styles.line}>
                      <Dropdown
                        options={data.rankOptions.filter((o) => o.value !== "none").map((o) => ({ value: o.value, label: o.label }))}
                        value={rankNone ? "" : vals.rank}
                        label={!canRank ? "請先填系統與中心" : rankNone ? "無" : vals.rank ? rankLabel(vals.rank) : "請選擇"}
                        disabled={!canRank || rankNone}
                        onPick={set("rank")}
                      />
                      <NoneBox on={rankNone} disabled={!canRank} onToggle={() => set("rank")(rankNone ? "" : "none")} />
                    </View>
                  </Row>
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
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  req: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 },
  input: { minHeight: FIELD_H, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  none: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, minWidth: 60 },
  dropdown: { position: "absolute", left: 0, right: 0, borderWidth: 1, borderRadius: radius.md, zIndex: 60, overflow: "hidden" },
  search: { minHeight: 40, borderBottomWidth: 1, paddingHorizontal: space.md, fontSize: 15 },
  opt: { minHeight: 44, paddingHorizontal: space.md, justifyContent: "center" },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 36 },
});
