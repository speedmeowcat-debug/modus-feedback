import fs from "node:fs";
import path from "node:path";
import { MIGRATIONS } from "./migrations";
import { seedIfEmpty } from "./seed";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  kind: "pglite" | "postgres";
}

async function openPglite(dir: string | null): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dir) fs.mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
  const pg = dir ? new PGlite(path.resolve(dir)) : new PGlite();
  await pg.waitReady;
  return {
    kind: "pglite",
    async query(sql, params) {
      return (await pg.query(sql, params as any[])).rows as any;
    },
    async tx(fn) {
      return (await pg.transaction(async (t) =>
        fn({ query: async (sql, params) => (await t.query(sql, params as any[])).rows as any }),
      )) as any;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
}

async function openPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  return {
    kind: "postgres",
    async query(sql, params) {
      return (await pool.query(sql, params as any[])).rows as any;
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async (sql, params) => (await client.query(sql, params as any[])).rows as any,
        });
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

export async function migrate(db: Db): Promise<void> {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const done = new Set((await db.query<{ id: string }>("SELECT id FROM schema_migrations")).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.exec(`BEGIN;\n${m.sql}\nINSERT INTO schema_migrations (id) VALUES ('${m.id}');\nCOMMIT;`);
    console.log(`[db] применена миграция ${m.id}`);
  }
}

/** Открывает базу, применяет миграции и при пустой базе загружает демонстрационные данные. */
export async function openDb(opts?: { memory?: boolean }): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  const db = opts?.memory
    ? await openPglite(null)
    : url
      ? await openPostgres(url)
      : await openPglite(process.env.PGLITE_DIR?.trim() || ".data/pglite");
  await migrate(db);
  await seedIfEmpty(db);
  return db;
}

const g = globalThis as unknown as { __modusDb?: Promise<Db> };

/** Один экземпляр на процесс: PGlite не допускает двух подключений к одному каталогу. */
export function getDb(): Promise<Db> {
  if (!g.__modusDb) {
    g.__modusDb = openDb().catch((e) => {
      g.__modusDb = undefined;
      throw e;
    });
  }
  return g.__modusDb;
}

/** Собирает нумерованные параметры: p.add(v) возвращает "$n". */
export class Params {
  values: unknown[] = [];
  add(v: unknown): string {
    this.values.push(v);
    return `$${this.values.length}`;
  }
}
