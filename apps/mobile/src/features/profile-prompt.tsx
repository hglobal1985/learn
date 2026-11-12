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

/** 單一文字欄位：輸入時顯示中央的「關聯詞」建議，點一下帶入；「儲存」直接寫回會員中心。 */
function TextRow({ label, hint, initial, pool, fieldKey, onSaved, pending }: { label: string; hint?: string; initial: string; pool?: "education_system" | "education_center"; fieldKey: string; onSaved: () => void; pending?: string | null }) {
  const [value, setValue] = useState(initial);
  const [sugg, setSugg] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setValue(initial), [initial]);
  const type = (v: string) => {
    setValue(v);
    setMsg(null);
    if (!pool) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api<string[]>("GET", `/me/vocab?pool=${pool}&q=${encodeURIComponent(v)}`)
        .then((s) => setSugg(v.trim() && s.length === 1 && s[0] === v.trim() ? [] : s))
        .catch(() => setSugg([]));
    }, 250);
  };
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ status: string | null }>("PUT", "/me/central-profile", { key: fieldKey, value });
      setSugg([]);
      setMsg({ ok: true, text: r.status === "pending" ? "已送出，等待審核" : "已儲存到會員中心" });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: space.xs }}>
      <Field label={label} value={value} onChange={type} hint={hint} />
      {sugg.length ? (
        <View style={styles.chips}>
          {sugg.map((s) => (
            <Pressable key={s} onPress={() => (setValue(s), setSugg([]))} accessibilityRole="button" style={styles.chip}>
              <AppText variant="callout">{s}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {pending ? <AppText variant="caption" tone="warning">審核中的新值：{pending}</AppText> : null}
      <Button label="儲存" variant="secondary" disabled={busy || value.trim() === initial.trim()} loading={busy} onPress={save} />
      {msg ? <NoticeBox tone={msg.ok ? "success" : "danger"} text={msg.text} /> : null}
    </View>
  );
}

/**
 * 會員資料未完整時的彈出視窗：蓋在首頁上層，約 70%×70%、內容可上下捲動，右上角大 X 可暫時關閉（下次登入會再提醒）。
 * 直接在這裡填「真實姓名、培訓系統、地區教育中心、獎銜」，用會員本人的身分寫回會員中心（行動大學不保存這些資料）。
 * 培訓系統、地區教育中心提供中央的關聯詞建議。「我是 Amway 會員」的勾選與同意說明在會員中心，這裡不代為勾選。
 */
export function ProfilePrompt({ onClose }: { onClose: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const { invalidate } = useSession();
  const [data, setData] = useState<View_ | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rankOpen, setRankOpen] = useState(false);
  const [rankMsg, setRankMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => {
    api<View_>("GET", "/me/central-profile")
      .then((d) => (setData(d), setError(null)))
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const saved = () => {
    load();
    invalidate();
  };
  const rankLabel = (v: string) => data?.rankOptions.find((o) => o.value === v)?.label ?? v;
  const pickRank = async (value: string) => {
    setRankMsg(null);
    try {
      const r = await api<{ status: string | null }>("PUT", "/me/central-profile", { key: "rank", value });
      setRankMsg({ ok: true, text: r.status === "pending" ? "已送出，等待審核" : "已儲存到會員中心" });
      setRankOpen(false);
      saved();
    } catch (e) {
      setRankMsg({ ok: false, text: (e as Error).message });
    }
  };
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border, width: Math.max(300, width * 0.86), maxWidth: 520, maxHeight: height * 0.8 }]}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉" hitSlop={8} style={styles.close}>
            <Icon name="close-circle" size={44} color={c.textMuted} />
          </Pressable>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
            <AppText variant="title" style={{ paddingRight: 48 }}>
              請完善會員基本資料
            </AppText>
            <AppText variant="callout" tone="muted">
              在這裡填寫會直接儲存到寰宇中央會員。你也可以隨時點首頁的姓名與獎銜，到會員中心編輯更詳細的基本資料。
            </AppText>
            {error ? <NoticeBox tone="danger" text={error} /> : null}
            {!data && !error ? <AppText tone="muted">讀取中…</AppText> : null}
            {data ? (
              <>
                <TextRow label="真實姓名（報名課程對帳用）" hint="只有你本人與負責對帳的人員看得到，付費報名時會記一份給對帳使用。" initial={data.legalName} fieldKey="legal_name" onSaved={saved} />
                {data.enabled ? (
                  <>
                    <TextRow label="培訓系統" hint="輸入後點下方的關聯詞即可帶入。" initial={data.fields.education_system.value} pool="education_system" fieldKey="education_system" pending={data.fields.education_system.pending} onSaved={saved} />
                    <TextRow label="地區教育中心" hint={data.hglobal ? "輸入後點下方的關聯詞即可帶入。" : "寰宇系統的會員才有中心關聯詞；也可以自行輸入。"} initial={data.fields.education_center.value} pool={data.hglobal ? "education_center" : undefined} fieldKey="education_center" pending={data.fields.education_center.pending} onSaved={saved} />
                    <View style={{ gap: space.xs }}>
                      <AppText variant="callout" tone="muted">
                        獎銜
                      </AppText>
                      <Pressable onPress={() => setRankOpen(!rankOpen)} accessibilityRole="button" style={[styles.select, { borderColor: c.border, backgroundColor: c.surface }]}>
                        <AppText style={{ flex: 1 }}>{data.fields.rank.value ? rankLabel(data.fields.rank.value) : "請選擇獎銜"}</AppText>
                        <Icon name={rankOpen ? "chevron-up" : "chevron-down"} size={20} color={c.textMuted} />
                      </Pressable>
                      {rankOpen ? (
                        <ScrollView style={[styles.list, { borderColor: c.border }]} nestedScrollEnabled>
                          {data.rankOptions.map((o) => (
                            <Pressable key={o.value} onPress={() => pickRank(o.value)} accessibilityRole="button" style={[styles.opt, o.value === data.fields.rank.value && { backgroundColor: c.accentSoft }]}>
                              <AppText>{o.label}</AppText>
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : null}
                      {data.fields.rank.pending ? <AppText variant="caption" tone="warning">審核中的新值：{rankLabel(data.fields.rank.pending)}</AppText> : null}
                      {rankMsg ? <NoticeBox tone={rankMsg.ok ? "success" : "danger"} text={rankMsg.text} /> : null}
                    </View>
                  </>
                ) : (
                  <NoticeBox text="培訓系統、地區教育中心、獎銜屬於「我是 Amway 會員」的資料。要填寫，請先到會員中心勾選「我是 Amway 會員」並閱讀同意說明。" />
                )}
              </>
            ) : null}
            <Button label="前往會員中心完善更多資料" variant="secondary" icon="open-outline" onPress={openAccountCenter} fullWidth />
            <Button variant="ghost" label="暫時不要，下次登入再提醒我" onPress={onClose} fullWidth />
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: { minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: "#e2dfd2", justifyContent: "center" },
  select: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm },
  list: { maxHeight: 220, borderWidth: 1, borderRadius: radius.md },
  opt: { minHeight: 44, paddingHorizontal: space.md, justifyContent: "center" },
});
