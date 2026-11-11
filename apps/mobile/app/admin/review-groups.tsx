import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api, DUTY_LABELS, type Duty, type ReviewGroup } from "@/api/client";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";
import { AppText, Button, Card, Chips, EmptyState, ErrorView, Field, Icon, LoadingView, NoticeBox, Pill, Screen } from "@/ui";

const ALL = "";
const duties = (Object.keys(DUTY_LABELS) as Duty[]).map((key) => ({ key, label: DUTY_LABELS[key] }));

/**
 * 審核群組：一個群組可套用到多門課；成員依中心分列，一眼看出每個中心由誰負責。
 * 「全部中心」列是總窗口：某中心沒有設定窗口時由總窗口處理。
 */
export default function ReviewGroupsScreen() {
  const { member, ready, invalidate } = useSession();
  const groups = useApi<ReviewGroup[]>(member ? "/admin/review-groups" : null);
  const centers = useApi<string[]>(member ? "/centers" : null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      invalidate();
      return true;
    } catch (e) {
      setMsg((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (ready && !member) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="請先登入" /></Screen>;
  if (groups.error && !groups.data) return <Screen header={false}><ErrorView message={groups.error} onRetry={groups.reload} /></Screen>;
  if (!groups.data) return <Screen header={false}><LoadingView /></Screen>;
  const isAdmin = member?.role === "admin";
  return (
    <Screen header={false}>
      <NoticeBox text="報名窗口、收費窗口、審核員都可以審核報名；差別在學員會看到自己中心的「收費窗口」姓名，知道要向誰繳費。要加入的人請先登入行動大學，到「我的」頁複製會員 ID 給你。" />
      {msg ? <NoticeBox tone="danger" text={msg} /> : null}
      {!groups.data.length ? <EmptyState icon="people-outline" title="還沒有審核群組" body="建立群組後，到課程的「編輯」頁把課程指定給群組。" /> : null}
      {groups.data.map((g) => (
        <GroupCard key={g.id} group={g} centers={centers.data ?? []} run={run} busy={busy} />
      ))}
      <Card>
        <AppText variant="headline">建立審核群組</AppText>
        <Field label="群組名稱" value={name} onChange={setName} placeholder="例如：翡翠達標班" />
        <Button
          label={isAdmin ? "建立總部群組" : `建立 ${member?.center ?? ""} 的群組`}
          icon="add"
          loading={busy}
          disabled={!name.trim()}
          onPress={async () => {
            if (await run(() => api("POST", "/admin/review-groups", { name, ownerCenter: isAdmin ? null : member?.center }))) setName("");
          }}
        />
      </Card>
    </Screen>
  );
}

function GroupCard({ group, centers, run, busy }: { group: ReviewGroup; centers: string[]; run: (fn: () => Promise<unknown>) => Promise<boolean>; busy: boolean }) {
  const { c } = useTheme();
  const [adding, setAdding] = useState(false);
  const [center, setCenter] = useState(ALL);
  const [duty, setDuty] = useState<Duty>("collect");
  const [sub, setSub] = useState("");
  // 依中心分列：全部中心（總窗口）排最前。
  const rows = [...new Set([ALL, ...group.members.map((m) => m.centerLabel)])];
  const post = (body: Record<string, unknown>) => run(() => api("POST", `/admin/review-groups/${group.id}/members`, body));

  return (
    <Card>
      <View style={styles.row}>
        <AppText variant="title" style={{ flex: 1 }}>
          {group.name}
        </AppText>
        <Pill label={group.ownerCenter ? `${group.ownerCenter} 自辦` : "總部群組"} tone="accent" />
      </View>
      <AppText variant="callout" tone="muted">
        套用課程：{group.courses.length ? group.courses.map((x) => x.title).join("、") : "尚未指定（到課程「編輯」頁選擇這個群組）"}
      </AppText>
      {rows.map((label) => {
        const members = group.members.filter((m) => m.centerLabel === label);
        if (label !== ALL && !members.length) return null;
        return (
          <View key={label || "all"} style={[styles.center, { borderColor: c.border }]}>
            <AppText variant="headline">{label || "全部中心（總窗口）"}</AppText>
            {!members.length ? (
              <AppText variant="callout" tone="muted">
                尚未指定；沒有窗口的中心會改通知總部秘書與超級管理員。
              </AppText>
            ) : null}
            {duties.map((d) => {
              const list = members.filter((m) => m.duty === d.key);
              if (!list.length) return null;
              return (
                <View key={d.key} style={styles.row}>
                  <AppText variant="callout" tone="muted" style={{ width: 72 }}>
                    {d.label}
                  </AppText>
                  {list.map((m) => (
                    <Pressable
                      key={m.memberSub}
                      disabled={busy}
                      onPress={() => post({ memberSub: m.memberSub, duty: m.duty, center: m.centerLabel, remove: true })}
                      accessibilityRole="button"
                      accessibilityLabel={`移除 ${m.memberName || m.memberSub}`}
                      style={[styles.person, { backgroundColor: c.surfaceMuted }]}
                    >
                      <AppText variant="callout">{m.memberName || `（尚未登入）${m.memberSub.slice(0, 8)}…`}</AppText>
                      <Icon name="close" size={14} color={c.textMuted} />
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        );
      })}
      {adding ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="callout" tone="muted">
            負責的中心
          </AppText>
          <Chips label="負責的中心" options={[{ key: ALL, label: "全部中心" }, ...centers.map((x) => ({ key: x, label: x }))]} value={center} onChange={setCenter} />
          <Chips label="職責" options={duties} value={duty} onChange={setDuty} />
          <Field label="會員 ID" value={sub} onChange={setSub} placeholder="對方在「我的」頁看到的會員 ID" />
          <View style={styles.row}>
            <Button
              label="加入"
              loading={busy}
              disabled={!sub.trim()}
              onPress={async () => {
                if (await post({ memberSub: sub.trim(), duty, center })) setSub("");
              }}
            />
            <Button variant="ghost" label="完成" onPress={() => setAdding(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Button variant="secondary" label="加入人員" icon="person-add-outline" onPress={() => setAdding(true)} />
          <Button variant="danger" label="刪除群組" disabled={busy} onPress={() => run(() => api("DELETE", `/admin/review-groups/${group.id}`))} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  center: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, gap: space.xs },
  person: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.sm + 2, paddingVertical: 4, borderRadius: radius.pill },
});
