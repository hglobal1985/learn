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
/** Cloudflare R2 中本專案用到的介面。 */
export interface R2Object {
  size: number;
  httpMetadata?: { contentType?: string };
}
export interface R2Bucket {
  head(key: string): Promise<R2Object | null>;
  get(key: string, opts?: { range?: { offset: number; length: number } }): Promise<(R2Object & { body: ReadableStream }) | null>;
  delete(key: string): Promise<void>;
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  createMultipartUpload(key: string, opts?: { httpMetadata?: { contentType?: string } }): Promise<{ uploadId: string }>;
  resumeMultipartUpload(
    key: string,
    uploadId: string,
  ): {
    uploadPart(partNumber: number, value: ArrayBuffer): Promise<{ partNumber: number; etag: string }>;
    complete(parts: { partNumber: number; etag: string }[]): Promise<unknown>;
  };
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
  /** R2 bucket「learn」：章節音檔。 */
  MEDIA?: R2Bucket;
  /** 音檔簽名網址用的 HMAC 金鑰（Secret）。 */
  MEDIA_URL_SECRET?: string;
  /** Cloudflare Email Service 的寄信綁定（send_email）。沒綁定就不寄 Email。 */
  EMAIL?: import("./email.ts").Mailer;
  /** 寄件地址，例如 noreply@learn.hglobal1985.com。 */
  EMAIL_FROM?: string;
  /** 中央會員 webhook 的簽章金鑰（Secret）。沒設定就不接收事件。 */
  CENTRAL_WEBHOOK_SECRET?: string;
  /** 中央會員「服務金鑰」（Secret）：寄信時向中央查詢聯絡信箱。沒設定就不寄 Email。 */
  CENTRAL_SERVICE_SECRET?: string;
}
