import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";

if (process.env.INVOICEY_APPLY_MCP_OAUTH !== "1") process.exit(0);
const connectionString =
  process.env.INVOICEY_DATABASE_URL_UNPOOLED ??
  process.env.INVOICEY_DATABASE_URL;
if (!connectionString)
  throw new Error("MCP migration requires a database connection");
const sql = neon(connectionString);
const expected = [
  "mcp_jwks",
  "mcp_oauth_clients",
  "mcp_oauth_consents",
  "mcp_oauth_access_tokens",
  "mcp_oauth_refresh_tokens",
];
const existing =
  await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY(${expected}::text[])`;
if (existing.length === expected.length) {
  console.log("MCP OAuth migration is already applied");
} else {
  if (existing.length)
    throw new Error(
      "Partial MCP OAuth schema found; inspect before applying the migration",
    );
  const source = await readFile(
    new URL("../sql/2026-10-01-mcp-oauth.sql", import.meta.url),
    "utf8",
  );
  // This checked-in migration contains only DDL statements, without procedural SQL or quoted semicolons.
  const statements = source
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(
      (statement) =>
        statement && statement !== "BEGIN" && statement !== "COMMIT",
    );
  await sql.transaction(statements.map((statement) => sql.query(statement)));
  console.log("MCP OAuth migration applied atomically");
}
