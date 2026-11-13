/**
 * 學習成就（徽章）：條件由超級管理員設定，會員的進度即時從學習紀錄計算（不另外存進度），
 * 達成時記錄取得時間並通知本人。
 */
import type { Achievement, AchievementType } from "./contract.ts";
import type { D1Database } from "./d1.ts";

type Def = { id: string; name: string; description: string; icon: string; condition_type: AchievementType; threshold: number; course_id: string | null };

const one = async (db: D1Database, sql: string, ...args: unknown[]) => Number((await db.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0);

/** 完整學完某門課（有章節且每一堂都完成）。 */
const courseDone = (db: D1Database, sub: string, courseId: string) =>
  one(
    db,
    "SELECT CASE WHEN (SELECT COUNT(*) FROM lessons WHERE course_id = ?1) > 0 AND (SELECT COUNT(*) FROM lesson_progress WHERE member_sub = ?2 AND course_id = ?1) >= (SELECT COUNT(*) FROM lessons WHERE course_id = ?1) THEN 1 ELSE 0 END AS n",
    courseId,
    sub,
  );

async function current(db: D1Database, sub: string, d: Def): Promise<number> {
  switch (d.condition_type) {
    case "lessons_completed":
      return one(db, "SELECT COUNT(*) AS n FROM lesson_progress WHERE member_sub = ?", sub);
    case "courses_enrolled":
      return one(db, "SELECT COUNT(DISTINCT course_id) AS n FROM enrollments WHERE member_sub = ?", sub);
    case "learning_days":
      return one(db, "SELECT COUNT(DISTINCT date(completed_at, '+8 hours')) AS n FROM lesson_progress WHERE member_sub = ?", sub);
    case "comments_posted":
      return one(db, "SELECT COUNT(*) AS n FROM course_comments WHERE member_sub = ?", sub);
    case "courses_completed":
      return one(
        db,
        `SELECT COUNT(*) AS n FROM (SELECT e.course_id FROM enrollments e WHERE e.member_sub = ?1 GROUP BY e.course_id
           HAVING (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id) > 0
              AND (SELECT COUNT(*) FROM lesson_progress p WHERE p.member_sub = ?1 AND p.course_id = e.course_id) >= (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id))`,
        sub,
      );
    case "course_completed":
      return d.course_id ? courseDone(db, sub, d.course_id) : 0;
  }
}

/**
 * 計算這位會員的所有啟用中徽章：達成的寫入取得時間（只寫一次）。
 * 回傳完整清單與這次「新取得」的徽章（呼叫端用來發通知）。
 */
export async function evaluateAchievements(db: D1Database, sub: string): Promise<{ list: Achievement[]; fresh: Achievement[] }> {
  const [defs, mine] = await Promise.all([
    db
      .prepare("SELECT a.id, a.name, a.description, a.icon, a.condition_type, a.threshold, a.course_id, (SELECT title FROM courses WHERE id = a.course_id) AS course_title FROM achievements a WHERE a.active = 1 ORDER BY a.sort_order, a.created_at")
      .all<Def & { course_title: string | null }>(),
    db.prepare("SELECT achievement_id, earned_at FROM member_achievements WHERE member_sub = ?").bind(sub).all<{ achievement_id: string; earned_at: string }>(),
  ]);
  const got = new Map(mine.results.map((r) => [r.achievement_id, r.earned_at]));
  const list: Achievement[] = [];
  const fresh: Achievement[] = [];
  const inserts = [];
  for (const d of defs.results) {
    const need = d.condition_type === "course_completed" ? 1 : d.threshold;
    const now = await current(db, sub, d);
    let earnedAt = got.get(d.id) ?? null;
    const earned = !!earnedAt || now >= need;
    const a: Achievement = { id: d.id, name: d.name, description: d.description, icon: d.icon, type: d.condition_type, threshold: need, courseTitle: d.course_title, current: Math.min(now, need), earned, earnedAt };
    if (earned && !earnedAt) {
      earnedAt = new Date().toISOString();
      a.earnedAt = earnedAt;
      inserts.push(db.prepare("INSERT OR IGNORE INTO member_achievements (member_sub, achievement_id, earned_at) VALUES (?, ?, ?)").bind(sub, d.id, earnedAt));
      fresh.push(a);
    }
    list.push(a);
  }
  if (inserts.length) await db.batch(inserts);
  return { list, fresh };
}
