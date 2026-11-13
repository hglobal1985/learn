import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, PAYMENT_METHODS, type Order, type PaymentMethodKey } from "@/api/client";
import { useTheme } from "@/theme/theme";
import { minTouch, radius, space, type } from "@/theme/tokens";
import { AppText, Button, Card, DateSelect, NoticeBox, Select, todayStr } from "@/ui";
import { showToast } from "@/ui/toast";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => ({ key: String(i), label: `${pad(i)} 時` }));
const MINUTES = Array.from({ length: 60 }, (_, i) => ({ key: String(i), label: `${pad(i)} 分` }));

/** 日期（年／月／日三個下拉）＋時間（時、分兩個下拉）；預設是今天、現在的時間。 */
function DateTimeSelect({ label, date, hour, minute, onDate, onHour, onMinute }: { label: string; date: string; hour: string; minute: string; onDate: (v: string) => void; onHour: (v: string) => void; onMinute: (v: string) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="callout" tone="muted">
        {label}
      </AppText>
      <DateSelect value={date} onChange={onDate} clearable={false} />
      <View style={styles.pair}>
        <Select label="時" value={hour} options={HOURS} onChange={onHour} />
        <Select label="分" value={minute} options={MINUTES} onChange={onMinute} />
      </View>
    </View>
  );
}

const toIso = (date: string, hour: string, minute: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(hour), Number(minute)).toISOString() : "";
};

/** 繳費方式：點選方式、依方式填欄位、按送出。送出後紀錄出現在下方（PaymentRecords）。全部放在同一頁，不收合。 */
export function PaymentForm({ order, onDone, leftAction }: { order: Order; onDone: () => void; leftAction?: React.ReactNode }) {
  const { c } = useTheme();
  const now = new Date();
  const [method, setMethod] = useState<PaymentMethodKey | null>(null);
  const [last5, setLast5] = useState("");
  const [friend, setFriend] = useState("");
  const [date, setDate] = useState(todayStr());
  const [hour, setHour] = useState(String(now.getHours()));
  const [minute, setMinute] = useState(String(now.getMinutes()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!method) return;
    setBusy(true);
    setErr(null);
    try {
      await api<Order>("POST", `/orders/${order.id}/payments`, {
        method,
        ...(method === "transfer" ? { last5: last5.trim(), paidAt: toIso(date, hour, minute) } : {}),
        ...(method === "linepay" ? { paidAt: toIso(date, hour, minute) } : {}),
        ...(method === "friend" ? { friendName: friend.trim() } : {}),
      });
      showToast("已送出，審核人員會核對");
      setLast5("");
      setFriend("");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ready = method === "cash" || (method === "transfer" && /^\d{5}$/.test(last5.trim())) || (method === "linepay" && !!date) || (method === "friend" && !!friend.trim());

  return (
    <View>
      <Card>
        <View style={styles.grid}>
          {PAYMENT_METHODS.map((m) => {
            const on = method === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setMethod(m.key)}
                style={[styles.method, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
              >
                <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? c.accent : c.textMuted} />
                <AppText variant="callout" style={{ color: on ? c.accentText : c.text, flexShrink: 1, fontWeight: "700" }}>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {method === "transfer" ? (
          <>
            <View style={{ gap: space.xs }}>
              <AppText variant="callout" tone="muted">
                轉出帳號末五碼
              </AppText>
              <TextInput
                value={last5}
                onChangeText={(v) => setLast5(v.replace(/\D/g, "").slice(0, 5))}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="例如：12345"
                placeholderTextColor={c.textMuted}
                accessibilityLabel="轉出帳號末五碼"
                style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
              />
            </View>
            <DateTimeSelect label="轉出日期時間" date={date} hour={hour} minute={minute} onDate={setDate} onHour={setHour} onMinute={setMinute} />
          </>
        ) : null}
        {method === "linepay" ? <DateTimeSelect label="LINE Pay 付款日期時間" date={date} hour={hour} minute={minute} onDate={setDate} onHour={setHour} onMinute={setMinute} /> : null}
        {method === "friend" ? (
          <View style={{ gap: space.xs }}>
            <AppText variant="callout" tone="muted">
              朋友的名字
            </AppText>
            <TextInput value={friend} onChangeText={setFriend} placeholder="例如：王小明" placeholderTextColor={c.textMuted} accessibilityLabel="朋友的名字" style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]} />
          </View>
        ) : null}

        {err ? <NoticeBox tone="danger" text={err} /> : null}
        <View style={styles.actions}>
          {leftAction ? <View style={{ flex: 1 }}>{leftAction}</View> : null}
          <View style={{ flex: 1 }}>
            <Button label="送出" icon="send-outline" loading={busy} disabled={busy || !ready} onPress={submit} fullWidth />
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  method: { flexGrow: 1, flexBasis: "45%", flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: minTouch + 8, paddingHorizontal: space.sm, borderWidth: 1.5, borderRadius: radius.md },
  input: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  actions: { flexDirection: "row", gap: space.sm },
  pair: { flexDirection: "row", gap: space.sm },
});
