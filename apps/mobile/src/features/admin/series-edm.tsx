import { AppText } from "@/ui";

/** iOS／Android：系列專屬 EDM 的上傳只在網頁版提供。 */
export function SeriesEdm(_props: { series: string; edmUrl?: string | null; onChanged: () => void }) {
  return (
    <AppText variant="caption" tone="muted">
      系列 EDM 請在網頁版上傳
    </AppText>
  );
}
