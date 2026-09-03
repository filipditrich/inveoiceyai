import { setPlatformRoleAction } from "@/actions/admin";
import { AdminAuditList } from "@/components/admin/admin-audit-list";
import { AdminCopyId } from "@/components/admin/admin-copy-id";
import {
  AdminEmpty,
  AdminFacts,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { adminGetUser } from "@/lib/admin/detail";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, UserRoundIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePlatformAdmin();
  const { id } = await params;
  const [t, tUsers, format] = await Promise.all([
    getTranslations("Admin.userDetail"),
    getTranslations("Admin.users"),
    getFormatter(),
  ]);

  const detail = await adminGetUser(id);
  if (!detail) {
    notFound();
  }

  const isAdmin = detail.platformRole === "admin";
  const isSelf = detail.id === actor.userId;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        href="/admin/users"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Link>

      <PageHeader
        description={detail.email}
        eyebrow={t("eyebrow")}
        icon={<UserRoundIcon />}
        title={detail.name || detail.email}
        actions={
          <form action={setPlatformRoleAction}>
            <input name="userId" type="hidden" value={detail.id} />
            <input
              name="role"
              type="hidden"
              value={isAdmin ? "none" : "admin"}
            />
            <input
              name="returnTo"
              type="hidden"
              value={`/admin/users/${detail.id}`}
            />
            <SubmitButton
              disabled={isSelf && isAdmin}
              size="sm"
              variant={isAdmin ? "outline" : "default"}
            >
              {isAdmin ? tUsers("actions.revoke") : tUsers("actions.grant")}
            </SubmitButton>
          </form>
        }
      />

      <AdminSection title={t("profileTitle")}>
        <AdminFacts
          items={[
            {
              label: tUsers("columns.role"),
              value: (
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {isAdmin ? tUsers("role.admin") : tUsers("role.none")}
                </Badge>
              ),
            },
            {
              label: tUsers("columns.verified"),
              value: detail.emailVerified
                ? tUsers("verified.yes")
                : tUsers("verified.no"),
            },
            {
              label: tUsers("columns.createdAt"),
              value: format.dateTime(detail.createdAt, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            },
            {
              label: tUsers("columns.lastSeen"),
              value: detail.lastSeenAt
                ? format.dateTime(detail.lastSeenAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : t("neverSeen"),
            },
            {
              label: tUsers("columns.referredBy"),
              value: detail.referredByEmail ?? "—",
            },
            {
              label: tUsers("columns.defaultWorkspace"),
              value: detail.defaultWorkspaceId ? (
                <Link
                  className="hover:underline"
                  href={`/admin/workspaces/${detail.defaultWorkspaceId}`}
                >
                  {detail.memberships.find(
                    (m) => m.workspaceId === detail.defaultWorkspaceId,
                  )?.workspaceName ?? detail.defaultWorkspaceId}
                </Link>
              ) : (
                "—"
              ),
            },
            {
              label: tUsers("columns.id"),
              value: <AdminCopyId value={detail.id} />,
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title={t("membershipsTitle")}
        description={t("membershipsDescription")}
      >
        {detail.memberships.length === 0 ? (
          <AdminEmpty>{t("noMemberships")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.workspace"),
              t("columns.role"),
              t("columns.joined"),
            ]}
            rows={detail.memberships.map((membership) => [
              <Link
                key="ws"
                className="hover:underline"
                href={`/admin/workspaces/${membership.workspaceId}`}
              >
                {membership.workspaceName}
              </Link>,
              <Badge key="role" variant="secondary">
                {membership.role}
              </Badge>,
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(membership.joinedAt, { dateStyle: "medium" })}
              </span>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection
        title={t("referralsTitle")}
        description={t("referralsDescription")}
        action={
          <Link
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            href="/admin/users"
          >
            {t("allUsers")}
          </Link>
        }
      >
        {detail.referredUsers.length === 0 ? (
          <AdminEmpty>{t("noReferrals")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[t("columns.email"), t("columns.signedUp")]}
            rows={detail.referredUsers.map((referred) => [
              referred.email,
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(referred.createdAt, { dateStyle: "medium" })}
              </span>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection title={t("auditTitle")} description={t("auditDescription")}>
        <AdminAuditList events={detail.auditEvents} showWorkspace />
      </AdminSection>
    </div>
  );
}
