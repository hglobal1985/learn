import type { Lesson } from "@/api/client";
import { AppText } from "@/ui";

/** iOS／Android：章節封面的上傳、裁切與影片截圖只在網頁版提供。 */
export function LessonArt(_props: { lesson: Lesson; onChanged: () => void }) {
  return (
    <AppText variant="caption" tone="muted">
      章節封面請在網頁版（learn.hglobal1985.com）設定。
    </AppText>
  );
}
