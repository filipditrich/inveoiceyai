/**
 * Prints row counts for every business table. Run before/after a schema push
 * to prove nothing was lost — the repo is push-only, so there is no migration
 * artifact to diff.
 *
 *   bun run --cwd packages/db scripts/row-counts.ts
 */
import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.local"), override: true });

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
  "presets",
];

for (const t of tables) {
  const exists = await sql`
    SELECT to_regclass(${`public.${t}`}) IS NOT NULL AS present
  `;
  if (!exists[0]?.present) {
    console.log(`${t.padEnd(28)} (table does not exist)`);
    continue;
  }
  const rows = await sql.query(`SELECT count(*)::int AS n FROM "${t}"`);
  console.log(`${t.padEnd(28)}${rows[0]!.n}`);
}
