/** Cloudflare D1 中本專案用到的介面（測試時以 node:sqlite 實作同一介面）。 */
export interface D1Result<T = unknown> {
  results: T[];
  meta?: { changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
export interface Env {
  DB: D1Database;
  /** "on" 時開放模擬會員登入（內部測試用；上架前改為 "off"）。 */
  DEMO_LOGIN?: string;
  MUX_SIGNING_KEY_ID?: string;
  MUX_SIGNING_PRIVATE_KEY?: string;
  /** Mux API 存取權杖（讀取影片清單用）：ID 可為一般變數，SECRET 必須是 Secret。 */
  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;
  /** 額外的 App 管理員（逗號分隔的中央會員 ID）；中央超級管理員不必列。 */
  LEARN_ADMIN_SUBS?: string;
}
