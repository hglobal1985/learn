import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import { api, resolveUrl, type Attachment } from "@/api/client";
import { AppText, Button, Card, ListRow, NoticeBox, Section } from "@/ui";

const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** 學員：上課頁的附件教材（只有已開通學員拿得到下載網址）。沒有附件時不顯示。 */
export function AttachmentList({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setItems([]);
    setError(null);
    api<Attachment[]>("GET", `/courses/${courseId}/lessons/${lessonId}/attachments`)
      .then(setItems)
      .catch(() => undefined);
  }, [courseId, lessonId]);
  if (!items.length) return null;
  return (
    <Section title="附件教材">
      <Card style={{ paddingVertical: 0 }}>
        {items.map((a) => (
          <ListRow
            key={a.id}
            icon="document-attach-outline"
            title={a.name}
            subtitle={sizeText(a.size)}
            onPress={a.url ? () => Linking.openURL(resolveUrl(a.url!)).catch(() => setError("無法開啟檔案")) : undefined}
          />
        ))}
      </Card>
      {error ? <NoticeBox tone="danger" text={error} /> : null}
    </Section>
  );
}

/** 管理員：在章節編輯卡片上傳／刪除附件（單檔 50MB 內）。 */
export function AttachmentManager({ lessonId }: { lessonId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const load = useCallback(() => {
    api<Attachment[]>("GET", `/admin/lessons/${lessonId}/attachments`)
      .then(setItems)
      .catch(() => undefined);
  }, [lessonId]);
  useEffect(load, [load]);

  const upload = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const file: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());
      if (file.size > 50 * 1024 * 1024) throw Error("附件大小需在 50MB 以內");
      await api("PUT", `/admin/lessons/${lessonId}/attachments?name=${encodeURIComponent(asset.name)}`, file);
      setMsg({ tone: "success", text: "附件已上傳" });
      load();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const remove = async (a: Attachment) => {
    setBusy(true);
    try {
      await api("DELETE", `/admin/attachments/${a.id}`);
      load();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppText variant="callout" tone="muted">
        附件教材（PDF、Word、PowerPoint、Excel、CSV、文字、ZIP、PNG、JPG；單檔 50MB 內）
      </AppText>
      {items.map((a) => (
        <ListRow key={a.id} icon="document-attach-outline" title={a.name} subtitle={sizeText(a.size)} right={<Button variant="ghost" label="刪除" disabled={busy} onPress={() => remove(a)} />} />
      ))}
      <Button variant="secondary" label="上傳附件" icon="attach-outline" loading={busy} onPress={upload} />
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
    </>
  );
}
