/**
 * Seeds a reviewable incoming-invoice queue so the UI is not empty.
 *
 *   bun run --cwd packages/db scripts/seed-incoming-invoices.ts
 */
import "@invoicey/env/load";

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error("DATABASE_URL is empty");

const sql = neon(url);

const [{ workspace_id: workspaceId }] = await sql`
  select id as workspace_id from workspaces order by created_at asc limit 1
`;
if (!workspaceId) throw new Error("no workspace");

const issuers = await sql`
  select id from issuer_businesses where workspace_id = ${workspaceId} order by is_default desc limit 1
`;
if (issuers.length === 0) throw new Error("no issuer_businesses row");
const issuerId = issuers[0].id as string;

const supplierIco = "12345679";
const existingSupplier = await sql`
  select id from suppliers where workspace_id = ${workspaceId} and ico = ${supplierIco} limit 1
`;
let supplierId = existingSupplier[0]?.id as string | undefined;
if (!supplierId) {
  const [created] = await sql`
    insert into suppliers (workspace_id, ico, dic, name, address, country, source, is_trusted)
    values (
      ${workspaceId},
      ${supplierIco},
      'CZ12345679',
      'Dodavatel Demo s.r.o.',
      '{"street":"Jindřišská 16","city":"Praha","zip":"11000","country":"CZ"}'::jsonb,
      'CZ',
      'manual',
      true
    )
    returning id
  `;
  supplierId = created.id as string;
}

const [account] = await sql`
  insert into supplier_bank_accounts (
    workspace_id, supplier_id, iban, account_number, bank_code, currency, confirmed_at
  )
  values (
    ${workspaceId},
    ${supplierId},
    'CZ6508000000192000145399',
    '2000145399',
    '0800',
    'CZK',
    now()
  )
  on conflict do nothing
  returning id
`;
const accountId =
  (account?.id as string | undefined) ??
  (
    await sql`
      select id from supplier_bank_accounts
      where supplier_id = ${supplierId}
      limit 1
    `
  )[0]?.id;

const samples = [
  {
    number: "FV-2026-1001",
    status: "needs_review",
    total: "12100.00",
    due: "2026-08-28",
    exceptions: ["new_beneficiary_account"],
  },
  {
    number: "FV-2026-1002",
    status: "approved",
    total: "4840.00",
    due: "2026-08-20",
    exceptions: [],
  },
  {
    number: "FV-2026-1003",
    status: "pending_approval",
    total: "24200.00",
    due: "2026-09-05",
    exceptions: [],
  },
  {
    number: "CN-2026-12",
    status: "accepted",
    total: "-1210.00",
    due: "2026-08-18",
    exceptions: [],
    docType: "credit_note",
  },
];

for (const sample of samples) {
  const normalized = sample.number.replaceAll(/[^A-Z0-9]/gu, "");
  await sql`
    insert into incoming_invoices (
      workspace_id,
      issuer_id,
      supplier_id,
      status,
      doc_type,
      number,
      number_normalized,
      supplier_name_raw,
      supplier_ico_raw,
      variable_symbol,
      issue_date,
      tax_date,
      due_date,
      received_date,
      currency,
      subtotal,
      vat_total,
      total,
      payment_method,
      beneficiary_iban,
      beneficiary_account_number,
      beneficiary_bank_code,
      supplier_bank_account_id,
      extraction_source,
      retain_until,
      exception_codes
    )
    values (
      ${workspaceId},
      ${issuerId},
      ${supplierId},
      ${sample.status},
      ${sample.docType ?? "invoice"},
      ${sample.number},
      ${normalized},
      'Dodavatel Demo s.r.o.',
      ${supplierIco},
      ${normalized.slice(-10)},
      '2026-08-10',
      '2026-08-10',
      ${sample.due},
      '2026-08-16',
      'CZK',
      ${String((Number(sample.total) / 1.21).toFixed(2))},
      ${String((Number(sample.total) - Number(sample.total) / 1.21).toFixed(2))},
      ${sample.total},
      'transfer',
      'CZ6508000000192000145399',
      '2000145399',
      '0800',
      ${accountId ?? null},
      'manual',
      '2036-12-31',
      ${JSON.stringify(sample.exceptions)}::jsonb
    )
    on conflict do nothing
  `;
}

console.log(`Seeded incoming invoices for workspace ${workspaceId}`);
