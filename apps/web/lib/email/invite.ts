import "server-only";

import { emailLocale, renderWorkspaceInviteEmail } from "@invoicey/emails";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { getLocale } from "next-intl/server";

import { getResendClient } from "./client";
import { buildViaInvoiceyDisplayName } from "./from";
import { sendTransactionalEmail } from "./send";

export async function sendWorkspaceInviteEmail(opts: {
  workspaceId: string;
  workspaceName: string;
  to: string;
  inviterName: string;
  inviterEmail?: string | null;
  role: string;
  inviteUrl: string;
  expiresAt?: Date | string | null;
}): Promise<void> {
  if (!getResendClient()) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const locale = emailLocale(await getLocale());
  const expiresAtLabel = formatInviteExpiry(opts.expiresAt, locale);

  const rendered = await renderWorkspaceInviteEmail({
    workspaceName: opts.workspaceName,
    inviterName: opts.inviterName,
    inviteUrl: opts.inviteUrl,
    role: opts.role,
    expiresAtLabel,
    locale,
  });

  const replyTo = opts.inviterEmail?.trim() || null;

  await sendTransactionalEmail({
    db,
    workspaceId: opts.workspaceId,
    template: "workspace_invite",
    to: opts.to,
    replyTo,
    displayName: buildViaInvoiceyDisplayName(opts.inviterName),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** prague-local label for czech invite mail */
export function formatInviteExpiry(
  value: Date | string | null | undefined,
  locale: "cs" | "en" = "cs",
): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(date);
}
