import AsyncStorage from "@react-native-async-storage/async-storage";

/** 記住這位學員最後開啟的一堂課，「學習中」頁面第一張卡用來「回到剛才的學習」。 */
export type LastLesson = { courseId: string; lessonId: string; lessonTitle: string; courseTitle: string };
const key = (sub: string) => `last-lesson:${sub}`;

export async function saveLastLesson(sub: string, v: LastLesson) {
  await AsyncStorage.setItem(key(sub), JSON.stringify(v)).catch(() => undefined);
}

export async function loadLastLesson(sub: string): Promise<LastLesson | null> {
  try {
    const raw = await AsyncStorage.getItem(key(sub));
    return raw ? (JSON.parse(raw) as LastLesson) : null;
  } catch {
    return null;
  }
}
