import type { CourseDetail } from "@/api/client";
import { NoticeBox, Section } from "@/ui";

/** iOS／Android：EDM 的上傳與裁切只在網頁版提供。 */
export function EdmManager(_props: { course: CourseDetail; onChanged: () => void }) {
  return (
    <Section title="課程海報（EDM）與封面">
      <NoticeBox text="上傳 EDM、設定 EDM 預設位置與裁切封面，請在網頁版（learn.hglobal1985.com）操作。" />
    </Section>
  );
}
