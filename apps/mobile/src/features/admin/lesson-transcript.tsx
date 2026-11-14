import { useRef, useState } from "react";
import { View } from "react-native";
import { api } from "@/api/client";
import { confirmSheet } from "@/features/confirm";
import { useApi } from "@/state/session";
import { space } from "@/theme/tokens";
import { AppText, Button, NoticeBox } from "@/ui";

type Transcript = { lessonId: string; status: "none" | "partial" | "done"; partsDone: number; partsTotal: number; model: string; text: string; minutes: number; updatedAt: string | null };

/**
 * 章節逐字稿（試做，只支援「上傳音檔」的章節）：一段一段轉，轉完一段就存一段；
 * 每日免費額度用完會自動停止，隔天（台灣 08:00 後）按「繼續」就從斷掉的那段接著做。
 */
export function LessonTranscript({ lessonId }: { lessonId: string }) {
  const { data, reload } = useApi<Transcript>(`/admin/lessons/${lessonId}/transcript`);
  const [view, setView] = useState<Transcript | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const stop = useRef(false);
  const t = view ?? data;

  const run = async (restart: boolean) => {
    stop.current = false;
    setRunning(true);
    setMsg(null);
    try {
      let cur: Transcript = await api<Transcript>("POST", `/admin/lessons/${lessonId}/transcript/next`, { restart });
      setView(cur);
      while (cur.status !== "done" && !stop.current) {
        cur = await api<Transcript>("POST", `/admin/lessons/${lessonId}/transcript/next`, {});
        setView(cur);
      }
      if (cur.status === "done") setMsg({ tone: "success", text: "逐字稿完成" });
      else setMsg({ tone: "success", text: "已暫停，按「繼續」可接著做" });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
      reload();
    } finally {
      setRunning(false);
    }
  };

  const again = async () => {
    if (await confirmSheet({ title: "重新轉逐字稿", message: "會刪除目前的逐字稿並從頭重做，也會再用掉 AI 額度。", confirmLabel: "重新轉", cancelLabel: "先不要", danger: true })) run(true);
  };

  const label = running ? "轉換中…（點一下暫停）" : t?.status === "partial" ? "繼續轉逐字稿" : "開始轉逐字稿";
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="callout">逐字稿（試做）</AppText>
      {t && t.status !== "none" ? (
        <AppText variant="caption" tone="muted">
          {t.status === "done" ? "已完成" : "進行中"}：{t.partsDone}／{t.partsTotal} 段，約 {t.minutes} 分鐘　使用 {t.model.split("/").pop()}
        </AppText>
      ) : (
        <AppText variant="caption" tone="muted">
          用 AI 把這個音檔轉成文字。會用到每日免費額度，用完自動停止、隔天接著做。
        </AppText>
      )}
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
      <Button variant="secondary" icon="document-text-outline" label={label} onPress={running ? () => (stop.current = true) : () => run(false)} />
      {t && t.status !== "none" && !running ? <Button variant="secondary" icon="refresh-outline" label="重新轉逐字稿" onPress={again} /> : null}
      {t?.text ? (
        <AppText variant="callout" selectable style={{ lineHeight: 26 }}>
          {t.text}
        </AppText>
      ) : null}
    </View>
  );
}
