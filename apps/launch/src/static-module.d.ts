// 部署時由 scripts/embed-static.mjs 產生，wrangler.jsonc 的 alias 指向 .generated/static-files.js。
declare module "learn:static" {
  export const files: Record<string, { type: string; data: string }>;
}
