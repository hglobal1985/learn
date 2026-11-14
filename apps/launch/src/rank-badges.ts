/**
 * 獎銜徽章圖：R2（learn）的 Pin-Level/NN-English-Name.png。
 * 以獎銜代碼（會員中心與本地階梯相同）對應圖檔；沒有徽章的獎銜（3%～21%、無）回 null。
 * 徽章網址只在記憶體算出，不保存任何會員的獎銜資料。
 */
export const RANK_BADGE_FILES: Record<string, string> = {
  r15b: "01-Bronze", silver: "02-Silver", gold: "03-Gold", platinum: "04-Platinum", ruby: "05-Ruby",
  f_platinum: "06-Founders-Platinum", f_ruby: "07-Founders-Ruby", pearl: "08-Pearl", sapphire: "09-Sapphire",
  f_sapphire: "10-Founders-Sapphire", emerald: "11-Emerald", f_emerald: "12-Founders-Emerald", diamond: "13-Diamond",
  f_diamond: "14-Founders-Diamond", exec_diamond: "15-EDC", f_exec_diamond: "16-Founders-EDC", double_diamond: "17-Double-Diamond",
  f_double_diamond: "18-Founders-Double-Diamond", triple_diamond: "19-Triple-Diamond", f_triple_diamond: "20-Founders-Triple-Diamond",
  crown: "21-Crown", f_crown: "22-Founders-Crown", crown_ambassador: "23-Crown-Ambassador", f_crown_ambassador: "24-Founders-Crown-Ambassador",
};

export const BADGE_FILE_RE = /^\d\d-[A-Za-z-]+$/;

/** 保險：萬一中央回的不是代碼而是中文名稱，也能對到（名稱與獎銜階梯一致）。 */
const LABEL_TO_CODE: Record<string, string> = {
  "15%銅章": "r15b", "銅章": "r15b", "銀章": "silver", "金章": "gold", "白金": "platinum", "紅寶石": "ruby", "創辦人白金": "f_platinum", "創辦人紅寶石": "f_ruby",
  "明珠": "pearl", "藍寶石": "sapphire", "創辦人藍寶石": "f_sapphire", "翡翠": "emerald", "創辦人翡翠": "f_emerald", "鑽石": "diamond", "創辦人鑽石": "f_diamond",
  "執行專才鑽石": "exec_diamond", "創辦人執行專才鑽石": "f_exec_diamond", "雙鑽石": "double_diamond", "創辦人雙鑽石": "f_double_diamond", "參鑽石": "triple_diamond",
  "創辦人參鑽石": "f_triple_diamond", "皇冠": "crown", "創辦人皇冠": "f_crown", "皇冠大使": "crown_ambassador", "創辦人皇冠大使": "f_crown_ambassador",
};

export function rankBadgeUrl(code: string | null | undefined, label?: string | null): string | null {
  const f = (code ? RANK_BADGE_FILES[code] ?? RANK_BADGE_FILES[LABEL_TO_CODE[code] ?? ""] : undefined) ?? (label ? RANK_BADGE_FILES[LABEL_TO_CODE[label.trim()] ?? ""] : undefined);
  return f ? `/api/v2/media/badge?f=${f}` : null;
}
