import type { Member } from "@/api/client";

/** 課程管理：管理員（超級管理員、總部秘書），或有所屬中心的會長、音控（只能管理主辦單位是自己中心的課程）。 */
export const canManageCourses = (m?: Member | null): boolean => !!m && (m.role === "admin" || (!!m.center && (m.titles.includes("會長") || m.titles.includes("音控"))));
