/** 超級管理員可調整的畫面設定：存在 ui_settings 一筆 JSON；讀取時和預設值合併，缺的欄位自動補上。 */
import { DEFAULT_UI_CONFIG, RIBBON_KEYS, RIBBON_PALETTE, SORT_GROUPS, STATS_ROLE_OPTIONS, type RibbonColor, type SortGroup, type UiConfig } from "./contract.ts";
import type { D1Database } from "./d1.ts";

const KEY = "ui_config";

/** 把任意輸入整理成合法設定（不合法的欄位退回預設，排序分組自動補齊缺的）。 */
export function normalizeConfig(raw: unknown): UiConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof UiConfig, unknown>>;
  const groups = Array.isArray(r.sortGroups) ? (r.sortGroups as unknown[]).filter((g): g is SortGroup => (SORT_GROUPS as readonly string[]).includes(g as string)) : [];
  const sortGroups = [...new Set([...groups, ...SORT_GROUPS])];
  const given = (r.ribbons && typeof r.ribbons === "object" ? r.ribbons : {}) as Record<string, { label?: unknown; color?: unknown; enabled?: unknown } | undefined>;
  const ribbons = { ...DEFAULT_UI_CONFIG.ribbons };
  for (const k of RIBBON_KEYS) {
    const g = given[k];
    if (!g) continue;
    const label = typeof g.label === "string" ? g.label.trim().slice(0, 20) : "";
    ribbons[k] = {
      label: label || DEFAULT_UI_CONFIG.ribbons[k].label,
      color: (RIBBON_PALETTE as readonly string[]).includes(g.color as string) ? (g.color as RibbonColor) : DEFAULT_UI_CONFIG.ribbons[k].color,
      enabled: g.enabled === undefined ? DEFAULT_UI_CONFIG.ribbons[k].enabled : g.enabled === true,
    };
  }
  const roles = Array.isArray(r.statsRoles) ? (r.statsRoles as unknown[]).filter((x): x is string => STATS_ROLE_OPTIONS.some((o) => o.key === x)) : [];
  return { sortGroups, ribbons, statsRoles: [...new Set(roles)] };
}

export async function loadConfig(db: D1Database): Promise<UiConfig> {
  const row = await db.prepare("SELECT value FROM ui_settings WHERE key = ?").bind(KEY).first<{ value: string }>();
  if (!row) return normalizeConfig({});
  try {
    return normalizeConfig(JSON.parse(row.value));
  } catch {
    return normalizeConfig({});
  }
}

export async function saveConfig(db: D1Database, cfg: UiConfig): Promise<void> {
  await db
    .prepare("INSERT INTO ui_settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(KEY, JSON.stringify(cfg))
    .run();
}
