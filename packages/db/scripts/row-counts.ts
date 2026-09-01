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
  "workspace_looks",
  "community_looks",
  "recurring_schedules",
  "presets",
  "bank_connections",
  "bank_accounts",
  "bank_account_issuers",
  "bank_transactions",
  "payment_match_proposals",
  "invoice_payment_allocations",
  "payment_audit_events",
  "inbox_aliases",
  "inbox_items",
  "incoming_documents",
  "suppliers",
  "supplier_bank_accounts",
  "incoming_invoices",
  "incoming_invoice_lines",
  "incoming_invoice_documents",
  "approval_rules",
  "approval_tasks",
  "payment_runs",
  "payment_run_lines",
  "payable_payment_allocations",
  "payable_match_proposals",
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
