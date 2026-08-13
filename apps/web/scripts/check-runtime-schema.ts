/** Fail a deployment when additive columns required by the running app are absent. */
import "@invoicey/env/load";

import { db } from "@invoicey/db/client";
import { sql } from "drizzle-orm";

const required = new Map([
  ["issuer_businesses", new Set(["is_default"])],
  ["invoices", new Set(["pdf_sha256", "isdoc_sha256"])],
]);

const result = await db.execute<{
  table_name: string;
  column_name: string;
}>(sql`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('issuer_businesses', 'invoices')
`);

for (const row of result.rows) {
  required.get(row.table_name)?.delete(row.column_name);
}

const missing = [...required].flatMap(([table, columns]) =>
  [...columns].map((column) => `${table}.${column}`),
);
if (missing.length > 0) {
  console.error(`Missing runtime schema columns: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Runtime schema is compatible with this Invoicey build.");
