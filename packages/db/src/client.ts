import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import * as schema from "./schema";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to initialize @invoicey/db`);
  }
  return value;
}

const sql = neon(requireEnv("DATABASE_URL"));

export const db = drizzle(sql, { schema });
