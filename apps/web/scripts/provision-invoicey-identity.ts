/** Offline operator command. No HTTP endpoint and no existing-account conversion. */
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";

import {
  createDb,
  account,
  user,
  workspaces,
  member,
  aiTokenBalances,
  initialAiTokenBalanceValues,
  resolvePlanForNewWorkspace,
} from "@invoicey/db";
import { withDbTransaction } from "@invoicey/db/transaction";

function argument(name: string) {
  return process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

async function main() {
  const db = createDb(
    z.string().min(1).parse(process.env.INVOICEY_DATABASE_URL),
  );
  const email = z.email().parse(argument("email")).trim().toLowerCase();
  const name = z.string().min(1).max(100).parse(argument("name"));
  const workspaceName = z.string().min(1).max(100).parse(argument("workspace"));
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1);
  if (existing.length)
    throw new Error(
      "Refusing to change an existing account. Use a new dedicated identity.",
    );
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run: would create a non-admin identity and isolated workspace. Use --apply with --password-file (mode 0600).",
    );
    return;
  }
  const passwordFile = z.string().min(1).parse(argument("password-file"));
  const file = await stat(passwordFile);
  if (!file.isFile() || (file.mode & 0o077) !== 0)
    throw new Error(
      "Password file must be a private regular file (mode 0600).",
    );
  const password = z
    .string()
    .min(16)
    .max(128)
    .parse((await readFile(passwordFile, "utf8")).replace(/\r?\n$/, ""));
  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const plan = await resolvePlanForNewWorkspace(db, {
    email,
    emailVerified: false,
  });
  await withDbTransaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name,
      email,
      emailVerified: false,
      defaultWorkspaceId: workspaceId,
      platformRole: "none",
    });
    await tx.insert(workspaces).values({
      id: workspaceId,
      name: workspaceName,
      slug: `identity-${workspaceId}`,
      planId: plan.id,
    });
    await tx.insert(member).values({
      id: crypto.randomUUID(),
      userId,
      organizationId: workspaceId,
      role: "owner",
      createdAt: new Date(),
    });
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    });
    await tx.insert(aiTokenBalances).values(
      initialAiTokenBalanceValues(workspaceId, new Date(), {
        monthlyIncludedTokens: plan.entitlements.ai.monthlyIncludedTokens,
        signupGiftedTokens: 0,
      }),
    );
  });
  console.log(
    JSON.stringify({
      userId,
      workspaceId,
      email,
      signIn: "https://invoicey.app/sign-in",
    }),
  );
}
main().catch(() => {
  console.error(
    "Provisioning failed; no credentials are logged. Check arguments, database access, email uniqueness and password-file permissions.",
  );
  process.exitCode = 1;
});
