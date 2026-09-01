import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@invoicey/env/server";

import * as schema from "./schema";

const sql = neon(env.DATABASE_URL);

/** Default HTTP client for RSC reads and simple mutations. */
export const db = drizzle(sql, { schema });
