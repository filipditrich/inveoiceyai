/**
 * Asserts every Better Auth model resolves to a Drizzle table with all of its
 * columns — including the `organization` -> `workspaces` remap (ADR 0019).
 *
 * Run after every `better-auth` upgrade, before applying schema changes: a new
 * release can add columns, and the adapter fails at runtime rather than at
 * build time.
 *
 *   bun run --cwd apps/web check:auth-schema
 *
 * Reads `auth.options` from the real auth server rather than rebuilding a
 * config here, so adding a plugin cannot silently make this check pass against
 * a different set of models than the app actually runs.
 */
// Side effect: repo-root .env, before anything reads process.env at import.
import "@invoicey/env/load";
import { getAuthTables } from "better-auth/db";

import { authSchema } from "@invoicey/db";

import { auth } from "../lib/auth/auth";

const tables = getAuthTables(auth.options);
const schema: Record<string, unknown> = authSchema;
let bad = 0;

for (const [model, def] of Object.entries(tables)) {
  const table = schema[model] as Record<string, unknown> | undefined;
  if (!table) {
    console.error(`MISSING  ${model} — no table in authSchema`);
    bad += 1;
    continue;
  }

  const columns = Object.keys(table);
  const missing = Object.keys(def.fields).filter((f) => !columns.includes(f));
  const sqlName = String(
    (table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")] ?? "?",
  );

  if (missing.length > 0) {
    console.error(
      `FAIL     ${model} -> ${sqlName}: missing ${missing.join(", ")}`,
    );
    bad += 1;
  } else {
    console.log(`ok       ${model} -> ${sqlName}`);
  }
}

if (bad > 0) {
  console.error(
    `\n${bad} model(s) do not resolve — update packages/db/src/auth-schema.ts`,
  );
  process.exit(1);
}
console.log(`\nAll ${Object.keys(tables).length} Better Auth models resolve.`);
