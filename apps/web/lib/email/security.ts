import "server-only";

import { emailLocale, renderNewSignInEmail } from "@invoicey/emails";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { getLocale } from "next-intl/server";

import { isEmailConfigured } from "./client";
import { sendTransactionalEmail } from "./send";

export async function sendNewSignInEmail(opts: {
  workspaceId: string;
  to: string;
  userName: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedInAt: string;
  trustUrl: string;
  securitySettingsUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const rendered = await renderNewSignInEmail({
    userName: opts.userName,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    signedInAt: opts.signedInAt,
    trustUrl: opts.trustUrl,
    securitySettingsUrl: opts.securitySettingsUrl,
    locale: emailLocale(await getLocale()),
  });

  await sendTransactionalEmail({
    db,
    workspaceId: opts.workspaceId,
    template: "new_sign_in",
    to: opts.to,
    displayName: "Invoicey",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

export function appOrigin(): string {
  return (env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
}
