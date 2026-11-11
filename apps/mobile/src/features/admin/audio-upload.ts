import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import { api } from "@/api/client";

const CHUNK = 8 * 1024 * 1024; // R2 分段上傳：除最後一段外每段至少 5MB。

/** 讀取音檔長度（秒）；只在 Web 可取得，其餘回傳 null。 */
function audioDuration(file: Blob): Promise<number | null> {
  if (Platform.OS !== "web") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => (URL.revokeObjectURL(url), resolve(Number.isFinite(a.duration) ? a.duration : null));
    a.onerror = () => (URL.revokeObjectURL(url), resolve(null));
    a.src = url;
  });
}

/** 選擇音檔並分段上傳到 R2（learn bucket），完成後該章節改為音檔。onProgress 回報 0～1。 */
export async function pickAndUploadAudio(lessonId: string, onProgress: (p: number) => void): Promise<"done" | "cancelled"> {
  const picked = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false });
  if (picked.canceled || !picked.assets?.length) return "cancelled";
  const asset = picked.assets[0];
  const file: Blob = asset.file ?? (await (await fetch(asset.uri)).blob());
  const contentType = asset.mimeType || file.type || "audio/mpeg";
  if (!contentType.startsWith("audio/")) throw Error("請選擇音訊檔（例如 MP3、M4A）");
  const size = file.size;
  const { key, uploadId } = await api<{ key: string; uploadId: string }>("POST", `/admin/lessons/${lessonId}/audio/start`, { fileName: asset.name, contentType, size });
  const parts: { partNumber: number; etag: string }[] = [];
  const total = Math.max(1, Math.ceil(size / CHUNK));
  for (let i = 0; i < total; i++) {
    const chunk = file.slice(i * CHUNK, Math.min(size, (i + 1) * CHUNK));
    const q = `key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&part=${i + 1}`;
    parts.push(await api<{ partNumber: number; etag: string }>("PUT", `/admin/lessons/${lessonId}/audio/part?${q}`, chunk));
    onProgress((i + 1) / total);
  }
  await api("POST", `/admin/lessons/${lessonId}/audio/complete`, { key, uploadId, parts, durationSeconds: await audioDuration(file) });
  return "done";
}
