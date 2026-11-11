import type { Course, State } from "@/domain/domain";

export function progressOf(state: State, course: Course): { done: number; total: number; ratio: number } {
  const done = (state.completed[course.id] ?? []).filter((id) => course.lessons.some((l) => l.id === id)).length;
  const total = course.lessons.length;
  return { done, total, ratio: total ? done / total : 0 };
}

export function totalMinutes(course: Course): number {
  return course.lessons.reduce((sum, l) => sum + l.minutes, 0);
}
