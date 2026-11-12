import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import { api, resolveUrl, type Attachment } from "@/api/client";
import { AppText, Button, Card, Field, ListRow, NoticeBox, Section, type IconName } from "@/ui";

const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** 依附件類型顯示圖示與說明文字（類型由伺服器依網域／副檔名判斷）。 */
const TYPE_INFO: Record<Attachment["type"], { icon: IconName; label: string }> = {
  youtube: { icon: "logo-youtube", label: "YouTube 影片" },
  vimeo: { icon: "logo-vimeo", label: "Vimeo 影片" },
  canva: { icon: "color-palette-outline", label: "Canva 簡報" },
  google_slides: { icon: "easel-outline", label: "Google 簡報" },
  google_docs: { icon: "document-text-outline", label: "Google 文件" },
  google_sheets: { icon: "grid-outline", label: "Google 試算表" },
  google_forms: { icon: "clipboard-outline", label: "Google 表單" },
  google_drive: { icon: "logo-google", label: "Google 雲端硬碟" },
  notion: { icon: "book-outline", label: "Notion 頁面" },
  web: { icon: "globe-outline", label: "網頁連結" },
  pdf: { icon: "document-text", label: "PDF" },
  word: { icon: "document-outline", label: "Word" },
  ppt: { icon: "easel-outline", label: "PowerPoint" },
  excel: { icon: "grid-outline", label: "Excel／CSV" },
  zip: { icon: "archive-outline", label: "壓縮檔" },
  image: { icon: "image-outline", label: "圖片" },
  text: { icon: "reader-outline", label: "文字檔" },
  file: { icon: "document-attach-outline", label: "檔案" },
};
const subtitleOf = (a: Attachment) => `${TYPE_INFO[a.type].label}${a.kind === "file" ? `・${sizeText(a.size)}` : ""}`;

/** 學員：上課頁的附件教材（只有已開通學員拿得到連結）。沒有附件時不顯示。 */
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
            icon={TYPE_INFO[a.type].icon}
            title={a.name}
            subtitle={subtitleOf(a)}
            onPress={a.url ? () => Linking.openURL(a.kind === "link" ? a.url! : resolveUrl(a.url!)).catch(() => setError("無法開啟連結")) : undefined}
          />
        ))}
      </Card>
      {error ? <NoticeBox tone="danger" text={error} /> : null}
    </Section>
  );
}

/** 管理員：在章節編輯卡片新增網址附件、上傳檔案、改標題、刪除。標題自訂；類型自動判斷。 */
export function AttachmentManager({ lessonId }: { lessonId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string; url: string | null } | null>(null);
  const load = useCallback(() => {
    api<Attachment[]>("GET", `/admin/lessons/${lessonId}/attachments`)
      .then(setItems)
      .catch(() => undefined);
  }, [lessonId]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "success", text: done });
      load();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const addLink = () =>
    run(async () => {
      await api("POST", `/admin/lessons/${lessonId}/links`, { url: linkUrl, title: linkTitle });
      setLinkUrl("");
      setLinkTitle("");
    }, "網址附件已新增");
  const upload = () =>
    run(async () => {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const file: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());
      if (file.size > 50 * 1024 * 1024) throw Error("附件大小需在 50MB 以內");
      await api("PUT", `/admin/lessons/${lessonId}/attachments?name=${encodeURIComponent(asset.name)}${linkTitle.trim() ? `&title=${encodeURIComponent(linkTitle.trim())}` : ""}`, file);
      setLinkTitle("");
    }, "附件已上傳");
  const saveEdit = () =>
    editing &&
    run(async () => {
      await api("PATCH", `/admin/attachments/${editing.id}`, { title: editing.title, ...(editing.url != null ? { url: editing.url } : {}) });
      setEditing(null);
    }, "已儲存");

  return (
    <>
      <AppText variant="callout" tone="muted">
        附件教材：可加網址（YouTube、Canva、Google 簡報／文件／表單／雲端硬碟、一般網頁；需 https）或上傳檔案（PDF、Word、PowerPoint、Excel、CSV、文字、ZIP、PNG、JPG，單檔 50MB 內）。標題可自訂，圖示依類型自動判斷。
      </AppText>
      {items.map((a) => (
        <Card key={a.id}>
          <ListRow
            icon={TYPE_INFO[a.type].icon}
            title={a.name}
            subtitle={subtitleOf(a)}
            onPress={() => setEditing(editing?.id === a.id ? null : { id: a.id, title: a.name, url: a.kind === "link" ? (a.url ?? "") : null })}
            right={<Button variant="ghost" label="刪除" disabled={busy} onPress={() => run(() => api("DELETE", `/admin/attachments/${a.id}`), "已刪除")} />}
          />
          {editing?.id === a.id ? (
            <>
              <Field label="顯示標題" value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} />
              {editing.url != null ? <Field label="網址" value={editing.url} onChange={(v) => setEditing({ ...editing, url: v })} placeholder="https://" /> : null}
              <Button label="儲存修改" disabled={busy || !editing.title.trim()} onPress={saveEdit} />
            </>
          ) : null}
        </Card>
      ))}
      <Field label="顯示標題（選填，空白＝依類型自動命名；上傳檔案時空白＝檔名）" value={linkTitle} onChange={setLinkTitle} placeholder="例如：第 4 堂簡報" />
      <Field label="網址" value={linkUrl} onChange={setLinkUrl} placeholder="https://www.canva.com/…" />
      <Button label="新增網址附件" icon="link-outline" disabled={busy || !linkUrl.trim()} onPress={addLink} />
      <Button variant="secondary" label="上傳檔案" icon="attach-outline" loading={busy} onPress={upload} />
      {msg ? <NoticeBox tone={msg.tone} text={msg.text} /> : null}
    </>
  );
}
