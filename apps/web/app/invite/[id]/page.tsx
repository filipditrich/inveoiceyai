import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { InviteAcceptClient } from "@/components/settings/invite-accept-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AppLocale } from "@/i18n/config";
import { auth } from "@/lib/auth/auth";
import {
  loadInvitationDetails,
  resolveInvitationViewState,
} from "@/lib/auth/invitation-details";
import { formatDateTime } from "@/lib/format";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Invite");
  const locale = (await getLocale()) as AppLocale;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(`/invite/${id}`)}`);
  }

  const invitation = await loadInvitationDetails(id);
  if (!invitation) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("notFound")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" render={<Link href="/" />}>
              {t("backToApp")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state = resolveInvitationViewState({
    invitation,
    signedInEmail: session.user.email,
  });
  const canAct = state === "pending";
  const role =
    invitation.role === "owner" ||
    invitation.role === "admin" ||
    invitation.role === "member"
      ? t(`roles.${invitation.role}`)
      : (invitation.role ?? "—");

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("workspace")}</dt>
              <dd className="font-medium">{invitation.organizationName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("inviter")}</dt>
              <dd className="font-medium">
                {invitation.inviterName || invitation.inviterEmail}
                {invitation.inviterEmail ? (
                  <span className="text-muted-foreground block text-xs font-normal">
                    {invitation.inviterEmail}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("role")}</dt>
              <dd className="font-medium">{role}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("email")}</dt>
              <dd className="font-medium">{invitation.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("expires")}</dt>
              <dd className="font-medium">
                {formatDateTime(invitation.expiresAt, locale)}
              </dd>
            </div>
          </dl>

          <p className="text-muted-foreground text-xs">
            {t("signedInAs", { email: session.user.email })}
          </p>

          {state === "expired" ? (
            <p className="text-destructive text-sm">{t("expired")}</p>
          ) : null}
          {state === "unavailable" ? (
            <p className="text-destructive text-sm">{t("unavailable")}</p>
          ) : null}
          {state === "email_mismatch" ? (
            <p className="text-destructive text-sm">
              {t("emailMismatch", {
                signedInEmail: session.user.email,
                inviteEmail: invitation.email,
              })}
            </p>
          ) : null}

          <InviteAcceptClient invitationId={id} canAct={canAct} />
          <Button variant="ghost" render={<Link href="/" />}>
            {t("backToApp")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
