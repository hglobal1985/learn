import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Database, D1PreparedStatement, D1Result } from "../src/d1.ts";

/** 以 node:sqlite 模擬 D1（測試用），並套用 migrations。 */
export function createTestDb(): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));

  const statement = (sql: string, values: unknown[] = []): D1PreparedStatement & { exec(): D1Result } => {
    const args = () => values.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v)) as never[];
    const exec = (): D1Result => {
      const st = db.prepare(sql);
      if (/^\s*(SELECT|WITH)/i.test(sql)) return { results: st.all(...args()) as unknown[] };
      const r = st.run(...args());
      return { results: [], meta: { changes: Number(r.changes) } };
    };
    return {
      bind: (...v: unknown[]) => statement(sql, v),
      first: async <T,>() => ((db.prepare(sql).get(...args()) as T | undefined) ?? null),
      all: async <T,>() => exec() as D1Result<T>,
      run: async () => exec(),
      exec,
    };
  };
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: D1PreparedStatement[]) => {
      db.exec("BEGIN");
      try {
        const out = statements.map((s) => (s as ReturnType<typeof statement>).exec());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
