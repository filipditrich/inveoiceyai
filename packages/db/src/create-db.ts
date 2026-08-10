import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export type InvoiceyDb = ReturnType<typeof createDb>;

/** Drizzle client without `@invoicey/env` (optional MCP / tools path). */
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

/** DB client when `DATABASE_URL` is set; otherwise `null`. */
export function tryCreateDbFromEnv(): InvoiceyDb | null {
  const url = process.env.DATABASE_URL?.trim();
  if (url == null || url === "") {
    return null;
  }
  return createDb(url);
}
