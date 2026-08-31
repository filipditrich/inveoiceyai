/** Fail a deployment when additive columns required by the running app are absent. */
import "@invoicey/env/load";

import { db } from "@invoicey/db/client";
import { sql } from "drizzle-orm";

const required = new Map([
  ["issuer_businesses", new Set(["is_default"])],
  ["workspaces", new Set(["default_look_id", "default_look_version"])],
  [
    "invoices",
    new Set([
      "pdf_sha256",
      "isdoc_sha256",
      "paid_amount",
      "payment_state",
      "payment_account_iban",
      "payment_variable_symbol",
      "look_id",
      "look_version",
    ]),
  ],
  [
    "bank_connections",
    new Set(["secret_ciphertext", "lease_until", "auto_confirm_exact_matches"]),
  ],
  ["bank_accounts", new Set(["iban", "currency"])],
  ["bank_transactions", new Set(["provider_transaction_id", "amount"])],
  ["payment_match_proposals", new Set(["matcher_version", "status"])],
  ["invoice_payment_allocations", new Set(["amount", "reversed_at"])],
  ["payment_audit_events", new Set(["action", "payload_json"])],
]);

const result = await db.execute<{
  table_name: string;
  column_name: string;
}>(sql`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'issuer_businesses',
      'workspaces',
      'invoices',
      'bank_connections',
      'bank_accounts',
      'bank_transactions',
      'payment_match_proposals',
      'invoice_payment_allocations',
      'payment_audit_events'
    )
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
