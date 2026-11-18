import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Serverless invocations can multiply the default 10 client connections and
// overwhelm Supabase's pooler. Use a small bounded pool per warm function.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 8_000,
  connectionTimeoutMillis: 8_000,
  allowExitOnIdle: true,
});
pool.on("error", (error: Error & { code?: string }) => {
  // Pool may emit asynchronous idle-connection errors. Never print credentials.
  console.warn("[TADARUK DB pool]", error.code ?? "connection_error");
});

/** Retry ONLY read-only database work on transient PostgreSQL/pooler failures.
 * Caller must not wrap mutations, uploads or externally visible side effects.
 */
export async function retryRead<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      const err = error as { code?: string; cause?: { code?: string } };
      const code = err?.cause?.code ?? err?.code;
      if (attempt >= 2 || !["XX000", "08000", "08001", "08003", "08006", "08004", "57P01", "53300"].includes(code ?? "")) {
        throw error;
      }
      await new Promise<void>(resolve => setTimeout(resolve, (attempt + 1) * 140));
    }
  }
}
export const db = drizzle(pool, { schema });

export * from "./schema";
