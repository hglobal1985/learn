import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { api, HQ_UNIT, type CourseDeleteImpact, type CourseDetail, type Rank, type ReviewGroup } from "@/api/client";
import { confirmAsk } from "@/features/confirm";
import { EdmManager } from "@/features/admin/edm-manager";
import { ntd, parseLocal, toLocal } from "@/features/format";
import { canManageCourses } from "@/lib/roles";
import { confirmSheet } from "@/features/confirm";
import { useApi, useSession } from "@/state/session";
import { useTheme } from "@/theme/theme";
import { courseThemes, minTouch, radius, space, type } from "@/theme/tokens";
import { todayStr } from "@/ui/date-select";
import { AppText, Button, Card, Chips, CourseCover, DateSelect, Field, EmptyState, LoadingView, NoticeBox, Pill, Screen, Section } from "@/ui";

type Form = { allowPresident: boolean; isPublic: boolean; priceTba: boolean; hideFromHome: boolean; diamondFree: boolean; series: string; earlyBird: boolean; earlyPriceTwd: string; earlyUntil: string; location: string; locationNone: boolean; isOnline: boolean; showFull: boolean; guidanceUnit: string; hostUnit: string; freeFrom: string; freeUntil: string; eventStart: string; eventEnd: string; reviewGroupId: string; title: string; category: string; priceTwd: string; minRankCode: string; theme: string; description: string };
const empty: Form = { allowPresident: false, isPublic: false, priceTba: false, hideFromHome: false, diamondFree: false, series: "", earlyBird: false, earlyPriceTwd: "", earlyUntil: "", location: "", locationNone: false, isOnline: false, showFull: true, guidanceUnit: HQ_UNIT, hostUnit: "", freeFrom: "", freeUntil: "", eventStart: "", eventEnd: "", reviewGroupId: "", title: "", category: "", priceTwd: "0", minRankCode: "none", theme: "sage", description: "" };

/** 管理員：新增或修改課程（沒有 id 參數時為新增）。 */
export default function CourseEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const { member, invalidate } = useSession();
  const canManage = canManageCourses(member);
  const isAdmin = member?.role === "admin"; // 總部管理員：可選指導／主辦單位；會長、音控固定為自己的中心
  const course = useApi<CourseDetail>(canManage && id ? `/courses/${id}` : null);
  const ranks = useApi<Rank[]>("/ranks");
  const centers = useApi<string[]>(isAdmin ? "/centers" : null);
  const groups = useApi<ReviewGroup[]>(canManage ? "/admin/review-groups" : null);
  const seriesList = useApi<string[]>(canManage ? "/admin/series" : null);
  const categoryList = useApi<string[]>(canManage ? "/admin/categories" : null);
  const locationList = useApi<string[]>(canManage ? "/admin/locations" : null);
  const [form, setForm] = useState<Form>(() => ({ ...empty, eventStart: todayStr(), ...(member?.role !== "admin" && member?.center ? { guidanceUnit: member.center, hostUnit: member.center } : {}) }));
  const [rankOpen, setRankOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  // 已有人報名的刪除確認（Hook 必須放在所有提前 return 之前）
  const [impact, setImpact] = useState<CourseDeleteImpact | null>(null);
  const [yes, setYes] = useState("");

  useEffect(() => {
    const d = course.data;
    if (d)
      setForm({
        allowPresident: d.allowPresident,
        isPublic: d.isPublic,
        priceTba: d.priceTba,
        hideFromHome: d.hideFromHome,
        diamondFree: d.diamondFree,
        series: d.series ?? "",
        earlyBird: !!d.earlyBird,
        earlyPriceTwd: d.earlyBird?.priceTwd != null ? String(d.earlyBird.priceTwd) : "",
        earlyUntil: d.earlyBird?.until ?? "",
        location: d.location,
        locationNone: d.locationNone,
        isOnline: d.isOnline,
        showFull: d.showFull,
        guidanceUnit: d.guidanceUnit,
        hostUnit: d.hostUnit,
        freeFrom: toLocal(d.admin?.freeFrom),
        freeUntil: toLocal(d.admin?.freeUntil),
        eventStart: d.eventStart ?? "",
        eventEnd: d.eventEnd ?? "",
        reviewGroupId: d.admin?.reviewGroupId ?? "",
        title: d.title,
        category: d.category,
        priceTwd: String(d.admin?.basePriceTwd ?? d.priceTwd ?? 0),
        minRankCode: d.minRank.code,
        theme: d.theme,
        description: d.description ?? "",
      });
  }, [course.data]);

  if (!canManage) return <Screen header={false}><EmptyState icon="lock-closed-outline" title="需要課程管理權限" /></Screen>;
  if (id && !course.data) return <Screen header={false}>{course.error ? <NoticeBox tone="danger" text={course.error} /> : <LoadingView />}</Screen>;

  const set = (k: Exclude<keyof Form, "allowPresident" | "isPublic" | "priceTba" | "hideFromHome" | "diamondFree" | "earlyBird" | "earlyUntil" | "location" | "locationNone" | "isOnline" | "showFull">) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const price = Number(form.priceTwd);
  /** 複製這門課成為新的草稿（日期、EDM、音檔不帶），然後直接到新課程的編輯頁。 */
  const duplicate = async () => {
    if (!id) return;
    if (!(await confirmSheet({ title: "複製這門課", message: "會建立一門新的草稿課程（名稱後面加「（複製）」），帶入費用、資格、章節架構，並放進同一個系列。活動日期、EDM、附件和音檔不會帶過去。", confirmLabel: "複製", cancelLabel: "先不要" }))) return;
    setBusy("dup");
    setMsg(null);
    try {
      const copy = await api<CourseDetail>("POST", `/admin/courses/${id}/duplicate`, {});
      invalidate();
      router.replace({ pathname: "/admin/course-edit", params: { id: copy.id } });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const save = async (status?: "draft" | "published") => {
    const freeFrom = parseLocal(form.freeFrom);
    const freeUntil = parseLocal(form.freeUntil);
    if (freeFrom === undefined || freeUntil === undefined) return setMsg({ tone: "danger", text: "限時免費的日期格式請用 2026-12-01 19:30" });
    if (form.earlyBird && !form.priceTba && price > 0) {
      const ep = Number(form.earlyPriceTwd);
      if (!Number.isInteger(ep) || ep < 1 || ep >= price) return setMsg({ tone: "danger", text: "早鳥優惠價請輸入比原價低的整數金額" });
      if (!form.earlyUntil) return setMsg({ tone: "danger", text: "請設定早鳥優惠的截止日期" });
    }
    setBusy(status ?? "save");
    setMsg(null);
    try {
      const body = { ...form, isPublic: price > 0 || form.priceTba ? false : form.isPublic, freeFrom, freeUntil, reviewGroupId: form.reviewGroupId || null, priceTwd: Number.isFinite(price) ? Math.round(price) : form.priceTwd, earlyBird: form.earlyBird && !form.priceTba && price > 0, earlyPriceTwd: Number(form.earlyPriceTwd), ...(status ? { status } : {}) };
      const d = id ? await api<CourseDetail>("PATCH", `/admin/courses/${id}`, body) : await api<CourseDetail>("POST", "/admin/courses", body);
      invalidate();
      if (!id) {
        router.replace({ pathname: "/admin/course/[id]", params: { id: d.id } });
        return;
      }
      setMsg({ tone: "success", text: status === "published" ? "已儲存並上架" : status === "draft" ? "已儲存並下架" : "已儲存" });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  // 已有人報名：先顯示影響，管理員必須手動輸入 YES 才能刪除。
  const remove = async () => {
    if (!id) return;
    setBusy("delete");
    setMsg(null);
    try {
      const info = await api<CourseDeleteImpact>("GET", `/admin/courses/${id}/delete-impact`);
      if (info.registrations > 0 && !isAdmin) {
        setMsg({ tone: "danger", text: "已有人報名的課程請改為「下架」；刪除只有總部管理員可以做。" });
        setBusy(null);
        return;
      }
      if (info.registrations > 0) {
        setImpact(info);
        setYes("");
        setBusy(null);
        return;
      }
      if (!(await confirmAsk("刪除課程", `確定刪除「${form.title}」？章節與音檔會一併刪除，無法復原。`))) return setBusy(null);
      await api("DELETE", `/admin/courses/${id}`);
      invalidate();
      router.replace("/admin/courses");
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
      setBusy(null);
    }
  };
  const removeConfirmed = async () => {
    if (!id || yes !== "YES") return;
    setBusy("delete");
    try {
      await api("DELETE", `/admin/courses/${id}`, { confirm: yes });
      invalidate();
      router.replace("/admin/courses");
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
      setBusy(null);
    }
  };

  const field = (label: string, k: Exclude<keyof Form, "allowPresident" | "isPublic" | "priceTba" | "hideFromHome" | "diamondFree" | "earlyBird" | "earlyPriceTwd" | "earlyUntil" | "location" | "locationNone" | "isOnline" | "showFull">, opts: { placeholder?: string; multiline?: boolean; numeric?: boolean } = {}) => (
    <View style={{ gap: space.xs }}>
      <AppText variant="callout" tone="muted">
        {label}
      </AppText>
      <TextInput
        value={form[k]}
        onChangeText={set(k)}
        placeholder={opts.placeholder}
        placeholderTextColor={c.textMuted}
        multiline={opts.multiline}
        keyboardType={opts.numeric ? "number-pad" : "default"}
        accessibilityLabel={label}
        style={[styles.input, type.body, opts.multiline && styles.multiline, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
      />
    </View>
  );
  const rank = ranks.data?.find((r) => r.code === form.minRankCode);

  return (
    <Screen header={false}>
      <Stack.Screen options={{ title: id ? "編輯課程" : "新增課程" }} />
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      <CourseCover theme={form.theme} label={form.category} title={form.title || "課程名稱"} imageUrl={course.data?.coverUrl ?? null} />
      <Card>
        {field("系列（同系列的課，全部課程清單只顯示最近的一場；不填＝不合併）", "series", { placeholder: "例如：翡翠達標班" })}
        {seriesList.data?.length ? <Chips label="已有的系列" options={[{ key: "", label: "不合併" }, ...seriesList.data.map((x) => ({ key: x, label: x }))]} value={form.series} onChange={set("series")} /> : null}
        {id ? (
          <Button variant="secondary" label="複製這門課，建立下一梯" icon="copy-outline" loading={busy === "dup"} disabled={!!busy} onPress={duplicate} fullWidth />
        ) : null}
      </Card>
      <Card>
        {field("課程名稱（必填）", "title", { placeholder: "例如：翡翠達標班" })}
        {field("分類（可複選，多個用「、」分開）", "category", { placeholder: "例如：達標班、會議" })}
        {categoryList.data?.length ? (
          <View style={{ gap: space.xs }}>
            <AppText variant="callout" tone="muted">
              已有的分類（點選可加入或取消，可複選）
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {categoryList.data.map((x) => {
                const cur = form.category.split(/[、,，]+/).map((v) => v.trim()).filter(Boolean);
                const on = cur.includes(x);
                return (
                  <Pressable
                    key={x}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => setForm((f) => ({ ...f, category: (on ? cur.filter((v) => v !== x) : [...cur, x]).join("、") }))}
                    style={[styles.catChip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
                  >
                    <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? c.accent : c.textMuted} />
                    <AppText variant="callout" style={{ color: on ? c.accentText : c.text, fontWeight: on ? "700" : "400" }}>
                      {x}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <View style={{ gap: space.xs }}>
          <AppText variant="callout" tone="muted">
            報名費用（新台幣，0 為免費）
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <TextInput
              value={form.priceTwd}
              onChangeText={set("priceTwd")}
              editable={!form.priceTba}
              keyboardType="number-pad"
              accessibilityLabel="報名費用"
              style={[styles.input, type.body, { flex: 1, color: c.text, borderColor: c.border, backgroundColor: c.surface, opacity: form.priceTba ? 0.5 : 1 }]}
            />
            <View>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.priceTba }} onPress={() => setForm((f) => ({ ...f, priceTba: !f.priceTba }))} style={styles.check}>
                <Ionicons name={form.priceTba ? "checkbox" : "square-outline"} size={28} color={form.priceTba ? c.accent : c.textMuted} />
                <AppText variant="body">尚未公布</AppText>
              </Pressable>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.diamondFree }} onPress={() => setForm((f) => ({ ...f, diamondFree: !f.diamondFree }))} style={styles.check}>
                <Ionicons name={form.diamondFree ? "checkbox" : "square-outline"} size={28} color={form.diamondFree ? c.accent : c.textMuted} />
                <AppText variant="body">鑽石免費</AppText>
              </Pressable>
            </View>
          </View>
        </View>
        {!form.priceTba && price > 0 ? (
          <View style={{ gap: space.xs }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.earlyBird }} onPress={() => setForm((f) => ({ ...f, earlyBird: !f.earlyBird }))} style={styles.check}>
              <Ionicons name={form.earlyBird ? "checkbox" : "square-outline"} size={28} color={form.earlyBird ? c.accent : c.textMuted} />
              <AppText variant="body">早鳥優惠</AppText>
            </Pressable>
            {form.earlyBird ? (
              <View style={{ gap: space.sm }}>
                <AppText variant="callout" tone="muted">
                  早鳥優惠價（新台幣，要比原價低）
                </AppText>
                <TextInput
                  value={form.earlyPriceTwd}
                  onChangeText={set("earlyPriceTwd")}
                  keyboardType="number-pad"
                  placeholder="例如：800"
                  placeholderTextColor={c.textMuted}
                  accessibilityLabel="早鳥優惠價"
                  style={[styles.input, type.body, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                />
                <DateSelect label="早鳥優惠截止日期（含當天，台灣時間）" value={form.earlyUntil} clearable={false} onChange={(v) => setForm((f) => ({ ...f, earlyUntil: v }))} />
              </View>
            ) : null}
          </View>
        ) : null}
        {form.diamondFree && !form.priceTba && price > 0 ? <Pill label="鑽石（含）以上獎銜的會員報名免費，其他會員照原價" tone="accent" /> : null}
        {form.priceTba ? <Pill label="費用尚未公布：課程頁顯示「費用尚未公布」，暫不開放報名" tone="warning" /> : price === 0 ? <Pill label="免費課程：報名後立即開通" tone="accent" /> : <Pill label="付費課程：報名後需審核繳費才開通" tone="warning" />}
        <View style={{ gap: space.xs }}>
          <AppText variant="callout" tone="muted">
            地點
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <TextInput
              value={form.location}
              onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
              editable={!form.locationNone && !form.isOnline}
              placeholder="例如：台北總部教室"
              placeholderTextColor={c.textMuted}
              accessibilityLabel="地點"
              style={[styles.input, type.body, { flex: 1, color: c.text, borderColor: c.border, backgroundColor: c.surface, opacity: form.locationNone || form.isOnline ? 0.5 : 1 }]}
            />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.locationNone }} onPress={() => setForm((f) => ({ ...f, locationNone: !f.locationNone }))} style={styles.check}>
              <Ionicons name={form.locationNone ? "checkbox" : "square-outline"} size={28} color={form.locationNone ? c.accent : c.textMuted} />
              <AppText variant="body">無</AppText>
            </Pressable>
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.isOnline }} onPress={() => setForm((f) => ({ ...f, isOnline: !f.isOnline }))} style={styles.check}>
            <Ionicons name={form.isOnline ? "checkbox" : "square-outline"} size={28} color={form.isOnline ? c.accent : c.textMuted} />
            <AppText variant="body">線上課程</AppText>
          </Pressable>
          {!form.locationNone && !form.isOnline && locationList.data?.length ? <Chips label="已有的場地" options={locationList.data.map((x) => ({ key: x, label: x }))} value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} /> : null}
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.showFull }} onPress={() => setForm((f) => ({ ...f, showFull: !f.showFull }))} style={styles.check}>
          <Ionicons name={form.showFull ? "checkbox" : "square-outline"} size={28} color={form.showFull ? c.accent : c.textMuted} />
          <AppText variant="body">顯示完整版</AppText>
        </Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.hideFromHome }} onPress={() => setForm((f) => ({ ...f, hideFromHome: !f.hideFromHome }))} style={styles.check}>
          <Ionicons name={form.hideFromHome ? "checkbox" : "square-outline"} size={28} color={form.hideFromHome ? c.accent : c.textMuted} />
          <AppText variant="body">不顯示首頁推薦</AppText>
        </Pressable>
        {field("課程介紹", "description", { multiline: true, placeholder: "課程內容、上課時間、適合對象……" })}
      </Card>

      <Section title="指導單位與主辦單位">
        <Card>
          <AppText variant="callout" tone="muted">
            指導單位（會公開顯示）
          </AppText>
          <Chips label="指導單位" options={isAdmin ? [{ key: HQ_UNIT, label: HQ_UNIT }, { key: "", label: "不顯示" }] : [{ key: member?.center ?? "", label: member?.center ?? "" }, { key: "", label: "不顯示" }]} value={form.guidanceUnit} onChange={set("guidanceUnit")} />
          {form.guidanceUnit === HQ_UNIT ? <NoticeBox text="由寰宇總部指導的課程，只有總部秘書與超級管理員可以指派審核人員。" /> : null}
          <AppText variant="callout" tone="muted">
            主辦單位（會公開顯示）
          </AppText>
          {isAdmin ? (
            <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {[HQ_UNIT, ...(centers.data ?? [])].map((x) => {
                const cur = form.hostUnit.split(/[、,，]+/).map((v) => v.trim()).filter(Boolean);
                const on = cur.includes(x);
                return (
                  <Pressable
                    key={x}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => setForm((f) => ({ ...f, hostUnit: (on ? cur.filter((v) => v !== x) : [...cur, x]).join("、") }))}
                    style={[styles.catChip, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
                  >
                    <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? c.accent : c.textMuted} />
                    <AppText variant="callout" style={{ color: on ? c.accentText : c.text, fontWeight: on ? "700" : "400" }}>
                      {x}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="caption" tone="muted">
              可複選。不勾＝不顯示；報名審核與管理權限以勾選的第一個中心為準。
            </AppText>
            </>
          ) : (
            <NoticeBox text={`主辦單位固定為「${member?.center ?? ""}」；你只能管理自己中心主辦的課程。`} />
          )}
        </Card>
      </Section>

      <Section title="活動日期（選填）">
        <Card>
            <DateSelect label="活動開始日期" value={form.eventStart} onChange={(v) => setForm((f) => ({ ...f, eventStart: v, ...(v ? {} : { eventEnd: "" }) }))} />
            {form.eventStart ? <DateSelect label="活動結束日期（連續 2～3 天才設定，單日不用）" value={form.eventEnd} defaultValue={form.eventStart} onChange={(v) => setForm((f) => ({ ...f, eventEnd: v }))} /> : null}
            <AppText variant="caption" tone="muted">
              顯示在課程介紹頁、首頁與「全部課程」的排序（最多連續 3 天）。
            </AppText>
        </Card>
      </Section>

      {price > 0 && !form.priceTba ? (
        <Section title="限時免費（選填）">
          <Card>
            <Field label="開始（空白＝立即）" value={form.freeFrom} onChange={set("freeFrom")} placeholder="2026-12-01 00:00" />
            <Field label="結束（空白＝不設定）" value={form.freeUntil} onChange={set("freeUntil")} placeholder="2026-12-31 23:59" hint="期間內報名免費、自動開通；結束後恢復原價。兩欄都空白表示不啟用。" />
          </Card>
        </Section>
      ) : null}

      <Section title="報名審核群組">
        <Card>
          <Chips
            label="審核群組"
            options={[{ key: "", label: isAdmin ? "未指定（由總部審核）" : "未指定（由本中心會長與總部處理）" }, ...(groups.data ?? []).filter((g) => (isAdmin ? form.guidanceUnit !== HQ_UNIT || g.ownerCenter === null : g.ownerCenter === member?.center)).map((g) => ({ key: g.id, label: g.name }))]}
            value={form.reviewGroupId}
            onChange={set("reviewGroupId")}
          />
          <Button variant="ghost" label="管理審核群組" icon="people-outline" onPress={() => router.push("/admin/review-groups")} />
        </Card>
      </Section>

      <Section title="報名資格">
        <Card>
          <View style={styles.row}>
            <AppText variant="callout" tone="muted">
              最低獎銜
            </AppText>
            <Pill label={rank?.name ?? form.minRankCode} tone="accent" />
            <Button variant="ghost" label={rankOpen ? "收合" : "變更"} onPress={() => setRankOpen(!rankOpen)} />
          </View>
          {rankOpen ? (
            <View style={styles.chips}>
              {(ranks.data ?? []).map((r) => {
                const active = r.code === form.minRankCode;
                return (
                  <Pressable
                    key={r.code}
                    onPress={() => (set("minRankCode")(r.code), setRankOpen(false))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
                  >
                    <AppText variant="callout" style={{ color: active ? c.textOnAccent : c.text, fontWeight: "600" }}>
                      {r.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {price > 0 || form.priceTba ? (
            <NoticeBox text="「完全公開」（訪客免登入可看）只限免費課程。" />
          ) : (
            <Chips
              label="誰可以瀏覽"
              options={[{ key: "no", label: "需要登入" }, { key: "yes", label: "完全公開（訪客免登入可看）" }]}
              value={form.isPublic ? "yes" : "no"}
              onChange={(v) => setForm((f) => ({ ...f, isPublic: v === "yes" }))}
            />
          )}
          {form.minRankCode !== "none" ? (
            <Chips
              label="會長"
              options={[{ key: "no", label: "只依獎銜" }, { key: "yes", label: "會長也可報名" }]}
              value={form.allowPresident ? "yes" : "no"}
              onChange={(v) => setForm((f) => ({ ...f, allowPresident: v === "yes" }))}
            />
          ) : null}
        </Card>
      </Section>

      <Section title="封面顏色">
        <View style={styles.chips}>
          {Object.keys(courseThemes).map((t) => (
            <Pressable
              key={t}
              onPress={() => set("theme")(t)}
              accessibilityRole="button"
              accessibilityLabel={`封面顏色 ${t}`}
              accessibilityState={{ selected: form.theme === t }}
              style={[styles.swatch, { borderColor: form.theme === t ? c.text : "transparent" }]}
            >
              <View style={[styles.swatchInner, { backgroundColor: courseThemes[t].light[1] }]} />
            </Pressable>
          ))}
        </View>
      </Section>

      {id && course.data ? <EdmManager course={course.data} onChanged={course.reload} /> : null}

      <View style={{ gap: space.sm }}>
        <Button label={id ? "儲存" : "建立課程（先不上架）"} icon="save-outline" loading={busy === "save"} disabled={!!busy} onPress={() => save()} fullWidth />
        {id && course.data?.status !== "published" ? (
          <Button variant="secondary" label="儲存並上架" icon="eye-outline" loading={busy === "published"} disabled={!!busy} onPress={() => save("published")} fullWidth />
        ) : null}
        {id && course.data?.status === "published" ? (
          <Button variant="secondary" label="下架" icon="eye-off-outline" loading={busy === "draft"} disabled={!!busy} onPress={() => save("draft")} fullWidth />
        ) : null}
        {id ? <Button variant="secondary" label="章節與影片" icon="list-outline" onPress={() => router.push({ pathname: "/admin/course/[id]", params: { id } })} fullWidth /> : null}
        {id ? <Button variant="danger" label="刪除課程" icon="trash-outline" loading={busy === "delete" && !impact} disabled={!!busy} onPress={remove} fullWidth /> : null}
      </View>
      {impact ? (
        <Card>
          <NoticeBox
            tone="danger"
            text={`警告：「${impact.title}」已有 ${impact.registrations} 筆報名紀錄（待審核 ${impact.pending}、已開通 ${impact.opened}，${impact.students} 位學員，已確認收款合計 ${ntd(impact.paidTwd)}）。刪除後，這些報名紀錄、繳費審核紀錄、學習進度、留言與章節、附件、音檔都會一併刪除，無法復原。建議先到「報名審核」匯出對帳報表（CSV）。`}
          />
          <Field label="確定要刪除請輸入大寫 YES" value={yes} onChange={setYes} placeholder="YES" />
          <View style={styles.row}>
            <Button variant="danger" label="確定刪除" icon="trash-outline" loading={busy === "delete"} disabled={yes !== "YES" || !!busy} onPress={removeConfirmed} />
            <Button variant="ghost" label="取消" disabled={!!busy} onPress={() => (setImpact(null), setYes(""))} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: minTouch - 4, paddingHorizontal: space.md, borderWidth: 1.5, borderRadius: radius.pill },
  check: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: minTouch },
  input: { minHeight: minTouch, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  multiline: { minHeight: 120, paddingTop: space.md, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: minTouch - 8, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  swatch: { width: minTouch, height: minTouch, borderRadius: minTouch / 2, borderWidth: 2, padding: 4 },
  swatchInner: { flex: 1, borderRadius: minTouch / 2 },
});
