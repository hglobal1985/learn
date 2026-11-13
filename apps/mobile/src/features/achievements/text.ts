import type { AchievementType } from "@/api/client";

/** 徽章條件的白話說明。 */
export function conditionText(type: AchievementType, threshold: number, courseTitle: string | null): string {
  switch (type) {
    case "lessons_completed":
      return `累計完成 ${threshold} 堂課`;
    case "courses_completed":
      return `累計學完 ${threshold} 門課程`;
    case "courses_enrolled":
      return `累計報名 ${threshold} 門課程`;
    case "learning_days":
      return `累計 ${threshold} 個不同的日子有學習紀錄`;
    case "comments_posted":
      return `在課程留言板留言 ${threshold} 次`;
    case "course_completed":
      return `學完「${courseTitle ?? "指定課程"}」`;
  }
}

/** 徽章圖示可選的表情符號。 */
export const BADGE_ICONS = ["🌱", "⭐", "🏆", "🎓", "🔥", "💬", "📚", "🎯", "💎", "🚀", "🏅", "👑", "🤝", "💡", "🌟", "🎖️"];
