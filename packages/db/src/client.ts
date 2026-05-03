import { env } from "@invoicey/env/server";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import * as schema from "./schema";

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
