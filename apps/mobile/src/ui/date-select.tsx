import { StyleSheet, View } from "react-native";
import { space } from "@/theme/tokens";
import { AppText } from "./text";
import { Button } from "./button";
import { Select, type SelectOption } from "./select";

const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** 今天（手機本機時間）的日期字串 YYYY-MM-DD。 */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();

/**
 * 日期選擇：年／月／日三個各自獨立的下拉選單（不用日曆）。
 * 月份加英文縮寫（例如「3 月 Mar」），避免和「日」搞混。
 * 沒有日期時顯示「設定日期（預設今天）」；新增資料時呼叫端直接給今天的日期。
 */
export function DateSelect({ label, value, onChange, clearable = true, defaultValue }: { label?: string; value: string; onChange: (v: string) => void; clearable?: boolean; defaultValue?: string }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const now = new Date().getFullYear();
  if (!m)
    return (
      <View style={styles.wrap}>
        {label ? <AppText variant="callout">{label}</AppText> : null}
        <Button variant="secondary" label={defaultValue ? "設定日期（預設與開始日同一天）" : "設定日期（預設今天）"} icon="calendar-outline" onPress={() => onChange(defaultValue || todayStr())} fullWidth />
      </View>
    );
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const set = (ny: number, nm: number, nd: number) => onChange(`${ny}-${pad(nm)}-${pad(Math.min(nd, daysIn(ny, nm)))}`);
  const years: SelectOption[] = [];
  for (let i = Math.min(now - 1, y); i <= Math.max(now + 5, y); i++) years.push({ key: String(i), label: `${i} 年`, short: `${i}` });
  const months: SelectOption[] = MONTH_EN.map((en, i) => ({ key: String(i + 1), label: `${i + 1} 月 ${en}`, short: `${i + 1}月` }));
  const days: SelectOption[] = Array.from({ length: daysIn(y, mo) }, (_, i) => ({ key: String(i + 1), label: `${i + 1} 日`, short: `${i + 1}日` }));
  return (
    <View style={styles.wrap}>
      {label ? <AppText variant="callout">{label}</AppText> : null}
      <View style={styles.row}>
        <View style={{ flex: 1.15 }}>
          <Select label="年" value={String(y)} options={years} onChange={(v) => set(Number(v), mo, d)} />
        </View>
        <View style={{ flex: 1.45 }}>
          <Select label="月" value={String(mo)} options={months} onChange={(v) => set(y, Number(v), d)} />
        </View>
        <View style={{ flex: 1 }}>
          <Select label="日" value={String(d)} options={days} onChange={(v) => set(y, mo, Number(v))} />
        </View>
      </View>
      {clearable ? <Button variant="ghost" label="清除日期" onPress={() => onChange("")} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: "row", gap: space.xs },
});
