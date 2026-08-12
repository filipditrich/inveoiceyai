/**
 * Prints row counts for every business table. Run before/after a schema change
 * to prove nothing was lost — the repo applies DDL by hand (see ../sql/README.md),
 * so there is no migration tool tracking what happened.
 *
 *   bun run --cwd packages/db scripts/row-counts.ts
 */
import "@invoicey/env/load";

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL is empty");

const sql = neon(url);

const tables = [
  "workspaces",
  "clients",
  "issuer_businesses",
  "issuer_numbering_schemes",
  "invoices",
  "invoice_items",
  "invoice_templates",
  "recurring_schedules",
  "presets",
];

for (const table of tables) {
  const [{ present }] = await sql`
    SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present
  `;
  if (!present) {
    console.log(`${table.padEnd(28)}(table does not exist)`);
    continue;
  }
  const [{ n }] = await sql.query(`SELECT count(*)::int AS n FROM "${table}"`);
  console.log(`${table.padEnd(28)}${n}`);
}
