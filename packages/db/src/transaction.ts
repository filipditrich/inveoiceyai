import { env } from "@invoicey/env/server";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

export type DbTransaction = Parameters<
	Parameters<NeonDatabase<typeof schema>["transaction"]>[0]
>[0];

let pool: Pool | null = null;
let transactionalDb: NeonDatabase<typeof schema> | null = null;

function getTransactionalDb(): NeonDatabase<typeof schema> {
	if (!pool) {
		pool = new Pool({
			connectionString: env.DATABASE_URL,
			max: 5,
			idleTimeoutMillis: 10_000,
		});
	}
	if (!transactionalDb) {
		transactionalDb = drizzle(pool, { schema });
	}
	return transactionalDb;
}

/**
 * Runs `fn` inside a WebSocket-backed interactive transaction (SELECT FOR UPDATE).
 * Prefer HTTP `db` for simple single-statement CRUD.
 */
export async function withDbTransaction<T>(
	fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
	return getTransactionalDb().transaction(async (tx) => fn(tx));
}
