import type { CourseDetail } from "@/api/client";
import { NoticeBox, Section } from "@/ui";

/** iOS／Android：EDM 與封面的裁切、合成只在網頁版提供。 */
export function CoverManager(_props: { course: CourseDetail; onChanged: () => void }) {
  return (
    <Section title="海報（EDM）與封面">
      <NoticeBox text="上傳 EDM、裁切與選擇封面底圖，請在網頁版（learn.hglobal1985.com）操作。" />
    </Section>
  );
}
