/**
 * Asserts every Better Auth model resolves to a Drizzle table with all of its
 * columns — including the `organization` -> `workspaces` remap (ADR 0019).
 *
 * Run after every `better-auth` upgrade, before `bun db:push`: a new release
 * can add columns, and the adapter fails at runtime rather than at build time.
 *
 *   bun run --cwd apps/web check:auth-schema
 */
import { apiKey } from "@better-auth/api-key";
import * as schema from "@invoicey/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getAuthTables } from "better-auth/db";
import { mcp, organization } from "better-auth/plugins";

const a = betterAuth({
  secret: "x".repeat(40),
  database: drizzleAdapter({} as never, { provider: "pg", schema: {} }),
  user: {
    additionalFields: {
      defaultWorkspaceId: { type: "string", required: false, input: false },
    },
  },
  plugins: [
    organization({ creatorRole: "owner" }),
    mcp({ loginPage: "/sign-in" }),
    apiKey(),
  ],
});

const remap: Record<string, unknown> = {
  ...schema,
  organization: schema.workspaces,
};
const tables = getAuthTables(a.options);
let bad = 0;

for (const [model, def] of Object.entries(tables)) {
  const t = remap[model] as Record<string, unknown> | undefined;
  if (!t) {
    console.log(`MISSING TABLE for model: ${model}`);
    bad += 1;
    continue;
  }
  const cols = Object.keys(t);
  const missing = Object.keys(def.fields).filter((f) => !cols.includes(f));
  const sqlName = String(
    (t as Record<symbol, unknown>)[Symbol.for("drizzle:Name")] ?? "?",
  );
  console.log(
    `${missing.length ? "FAIL " : "ok   "}${model.padEnd(20)}-> ${sqlName.padEnd(22)}${
      missing.length ? `missing: ${missing.join(",")}` : ""
    }`,
  );
  if (missing.length) bad += 1;
}

if (bad > 0) {
  console.error(
    `\n${bad} model(s) do not resolve — fix packages/db/src/auth-schema.ts`,
  );
  process.exit(1);
}
console.log("\nAll Better Auth models resolve.");
