import "server-only";
import { requireSession } from "@/lib/auth/session";
import { isEmailConfigured } from "@/lib/email/client";
import { appOrigin } from "@/lib/email/security";
import { sendTransactionalEmail } from "@/lib/email/send";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";

import { workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { emailLocale, renderTokenRewardEmail } from "@invoicey/emails";

import { formatTokenCount } from "./format-tokens";

/**
 * Announces a token award that just landed (ADR 0037).
 *
 * Called only when the grant ledger actually inserted, so it cannot fire twice
 * for the same award. Deliberately best-effort: a mail failure must not turn a
 * successful invoice issue into an error the user sees, since the tokens are
 * already credited and visible in Settings → Usage either way.
 */
export async function notifyTokenRewardByEmail(opts: {
  workspaceId: string;
  tokens: number;
}): Promise<void> {
  if (!isEmailConfigured()) return;

  try {
    const user = await requireSession();
    const [workspace] = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, opts.workspaceId))
      .limit(1);

    const rendered = await renderTokenRewardEmail({
      userName: user.name,
      tokens: formatTokenCount(opts.tokens),
      workspaceName: workspace?.name ?? "Invoicey",
      usageUrl: `${appOrigin()}/settings/workspace/usage`,
      locale: emailLocale(await getLocale()),
    });

    await sendTransactionalEmail({
      db,
      workspaceId: opts.workspaceId,
      template: "token_reward",
      to: user.email,
      displayName: "Invoicey",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (error) {
    console.error("[invoicey] token reward email failed", error);
  }
}
