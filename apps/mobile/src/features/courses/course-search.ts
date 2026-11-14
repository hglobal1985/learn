import type { CourseSummary } from "@/api/client";

/** 搜尋索引（後端 GET /search-index）裡每一堂章節的資料。 */
export type SearchLesson = { courseId: string; title: string; sharer: string; sharerRankName: string; sharerTitle: string; eventDate: string | null };
/** 關聯詞（輸入時列出的建議）：種類＋文字。 */
export type SearchTerm = { kind: "系列" | "課程" | "主講人" | "獎銜" | "職稱" | "章節" | "日期"; text: string };
export type SearchIndex = { haystack: Map<string, string>; terms: SearchTerm[] };

/** 2026-11-03 → 各種常見寫法，使用者打「11/3」「2026/11」「11月3日」都找得到。 */
export function dateForms(d: string | null | undefined): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? "");
  if (!m) return [];
  const [y, mo, da] = [m[1]!, m[2]!, m[3]!];
  const [n, dn] = [String(Number(mo)), String(Number(da))];
  return [`${y}/${n}/${dn}`, `${y}/${mo}/${da}`, `${y}-${mo}-${da}`, `${n}/${dn}`, `${mo}/${da}`, `${y}年${n}月${dn}日`, `${n}月${dn}日`, `${y}${mo}${da}`];
}

/**
 * 搜尋範圍：主講人（姓名、獎銜、職稱）、系列、課程名稱、章節標題、分享者、日期（課程日期與每一堂的日期）。
 * 每門課產生一串小寫文字，之後輸入的字只要被包含就算符合。
 */
export function buildSearchIndex(courses: CourseSummary[], lessons: SearchLesson[]): SearchIndex {
  const byCourse = new Map<string, SearchLesson[]>();
  for (const l of lessons) byCourse.set(l.courseId, [...(byCourse.get(l.courseId) ?? []), l]);
  const terms = new Map<string, SearchTerm>();
  const add = (kind: SearchTerm["kind"], text: string | null | undefined) => {
    const t = (text ?? "").trim();
    if (t) terms.set(`${kind}:${t}`, { kind, text: t });
  };
  const haystack = new Map<string, string>();
  for (const c of courses) {
    const parts: string[] = [c.title, c.series, c.teacher, c.teacherRankName, c.teacherTitle];
    add("課程", c.title);
    add("系列", c.series);
    add("主講人", c.teacher);
    add("獎銜", c.teacherRankName);
    add("職稱", c.teacherTitle);
    for (const d of [c.eventStart, c.eventEnd]) {
      parts.push(...dateForms(d));
      if (d) add("日期", dateForms(d)[0]);
    }
    for (const l of byCourse.get(c.id) ?? []) {
      parts.push(l.title, l.sharer, l.sharerRankName, l.sharerTitle, ...dateForms(l.eventDate));
      add("章節", l.title);
      add("主講人", l.sharer);
      add("獎銜", l.sharerRankName);
      add("職稱", l.sharerTitle);
      if (l.eventDate) add("日期", dateForms(l.eventDate)[0]);
    }
    haystack.set(c.id, parts.filter(Boolean).join("\u0001").toLowerCase());
  }
  return { haystack, terms: [...terms.values()] };
}

const tokens = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/** 符合的課程編號（空白搜尋＝null，代表不過濾）。多個詞用空白隔開時，每個詞都要符合。 */
export function matchCourses(index: SearchIndex, q: string): Set<string> | null {
  const t = tokens(q);
  if (!t.length) return null;
  const out = new Set<string>();
  for (const [id, hay] of index.haystack) if (t.every((w) => hay.includes(w))) out.add(id);
  return out;
}

/** 關聯詞：包含輸入文字的詞（最後一個詞為準），開頭相同的排前面；最多 limit 個。 */
export function suggestTerms(index: SearchIndex, q: string, limit = 8): SearchTerm[] {
  const last = tokens(q).at(-1);
  if (!last) return [];
  const hit = index.terms.filter((t) => t.text.toLowerCase().includes(last));
  hit.sort((a, b) => Number(b.text.toLowerCase().startsWith(last)) - Number(a.text.toLowerCase().startsWith(last)) || a.text.length - b.text.length);
  return hit.slice(0, limit);
}
