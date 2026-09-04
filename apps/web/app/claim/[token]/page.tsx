import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { setUserDefaultWorkspace } from "@/lib/auth/workspaces";
import { claimGuestWorkspaceForUser } from "@/lib/generator/claim";
import {
  CLAIM_COOKIE_NAME,
  claimCookieOptions,
  expiredClaimCookie,
} from "@/lib/generator/claim-cookie";
import { verifyGuestToken } from "@/lib/generator/tokens";
import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function InvalidClaim({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/sign-in" />}>{cta}</Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const t = await getTranslations("Claim");
  const payload = verifyGuestToken(token, "claim");
  if (!payload) {
    return (
      <InvalidClaim
        title={t("invalidTitle")}
        body={t("invalidBody")}
        cta={t("signIn")}
      />
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const cookieStore = await cookies();

  if (!session) {
    const cookie = claimCookieOptions(token);
    cookieStore.set(cookie.name, cookie.value, cookie.attributes);
    redirect(`/sign-in?next=${encodeURIComponent(`/claim/${token}`)}`);
  }

  const result = await claimGuestWorkspaceForUser({
    workspaceId: payload.w,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    },
  });

  const clear = expiredClaimCookie();
  cookieStore.set(clear.name, clear.value, clear.attributes);

  if (!result.ok) {
    return (
      <InvalidClaim
        title={t("invalidTitle")}
        body={t("invalidBody")}
        cta={t("signIn")}
      />
    );
  }

  await auth.api.setActiveOrganization({
    headers: await headers(),
    body: { organizationId: result.workspaceId },
  });
  await setUserDefaultWorkspace(session.user.id, result.workspaceId);
  redirect("/dashboard");
}

export { CLAIM_COOKIE_NAME };
