import {
  cancelWorkspaceInviteAction,
  deleteWorkspaceAction,
  grantWorkspaceTokensAction,
  removeWorkspaceMemberAction,
  renameWorkspaceAction,
} from "@/actions/admin";
import { assignWorkspacePlanAction } from "@/actions/admin-plans";
import { AdminAiChart } from "@/components/admin/admin-ai-chart";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { WorkspaceMark } from "@/components/workspace-mark";
import { loadWorkspaceAiMonitor } from "@/lib/admin/ai";
import { adminGetWorkspace } from "@/lib/admin/detail";
import { adminSelectablePlans } from "@/lib/admin/plans";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { ArrowLeftIcon, WarehouseIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getWorkspaceEntitlements } from "@invoicey/db";
import { db } from "@invoicey/db/client";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [t, tWorkspaces, format] = await Promise.all([
    getTranslations("Admin.workspaceDetail"),
    getTranslations("Admin.workspaces"),
    getFormatter(),
  ]);

  const detail = await adminGetWorkspace(id);
  if (!detail) {
    notFound();
  }

  const [entitlementState, selectablePlans, aiMonitor] = await Promise.all([
    getWorkspaceEntitlements(db, id),
    adminSelectablePlans(),
    loadWorkspaceAiMonitor(id),
  ]);

  const tokens = detail.tokens;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        href="/admin/workspaces"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Link>

      <PageHeader
        description={detail.slug}
        eyebrow={t("eyebrow")}
        icon={
          detail.logo ? (
            <WorkspaceMark
              className="size-11 rounded-2xl"
              logo={detail.logo}
              name={detail.name}
            />
          ) : (
            <WarehouseIcon />
          )
        }
        title={detail.name}
      />

      <AdminSection title={t("overviewTitle")}>
        <AdminFacts
          items={[
            {
              label: tWorkspaces("columns.members"),
              value: format.number(detail.members.length),
            },
            {
              label: tWorkspaces("columns.invoices"),
              value: format.number(detail.invoiceCount),
            },
            {
              label: tWorkspaces("columns.issuers"),
              value: format.number(detail.issuers.length),
            },
            {
              label: tWorkspaces("columns.createdAt"),
              value: format.dateTime(detail.createdAt, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            },
            {
              label: tWorkspaces("columns.slug"),
              value: detail.slug,
            },
            {
              label: tWorkspaces("columns.id"),
              value: <AdminCopyId value={detail.id} />,
            },
          ]}
        />
      </AdminSection>

      <AdminSection description={t("plan.description")} title={t("plan.title")}>
        {entitlementState ? (
          <>
            <AdminFacts
              items={[
                {
                  label: t("plan.current"),
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/plans/${entitlementState.planId}`}
                      >
                        {entitlementState.planName}
                      </Link>
                      {entitlementState.overrides ? (
                        <Badge variant="outline">{t("plan.overridden")}</Badge>
                      ) : null}
                    </span>
                  ),
                },
                {
                  label: t("plan.assigned"),
                  value: entitlementState.assignedBy
                    ? t("plan.assignedManually")
                    : t("plan.assignedAutomatically"),
                },
                {
                  label: t("plan.seats"),
                  value:
                    entitlementState.entitlements.seats.max ??
                    t("plan.unlimited"),
                },
                {
                  label: t("plan.monthlyTokens"),
                  value: formatTokenCount(
                    entitlementState.entitlements.ai.monthlyIncludedTokens,
                  ),
                },
              ]}
            />
            <form action={assignWorkspacePlanAction} className="mt-6 space-y-4">
              <input name="workspaceId" type="hidden" value={detail.id} />
              <div className="grid gap-4 sm:grid-cols-[16rem_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="planId">{t("plan.selectLabel")}</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue={entitlementState.planId}
                    id="planId"
                    name="planId"
                  >
                    {selectablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Downgrades keep everything: quotas are checked on the write
                  path, so an over-limit workspace stays readable (ADR 0035). */}
              <p className="text-xs text-muted-foreground">{t("plan.hint")}</p>
              <SubmitButton size="sm">{t("plan.submit")}</SubmitButton>
            </form>
          </>
        ) : (
          <AdminEmpty>{t("plan.missing")}</AdminEmpty>
        )}
      </AdminSection>

      <AdminSection
        title={t("tokensTitle")}
        description={t("tokensDescription")}
      >
        {tokens ? (
          <AdminFacts
            items={[
              {
                label: t("tokens.gifted"),
                value: format.number(tokens.giftedRemaining),
              },
              {
                label: t("tokens.monthly"),
                value: `${format.number(tokens.monthlyRemaining)} / ${format.number(tokens.monthlyLimit)}`,
              },
              {
                label: t("tokens.purchased"),
                value: format.number(tokens.purchasedRemaining),
              },
              {
                label: t("tokens.renewsAt"),
                value: format.dateTime(tokens.periodEnd, {
                  dateStyle: "medium",
                }),
              },
              {
                label: t("tokens.burn30d"),
                value: formatTokenCount(aiMonitor.burn30d),
              },
            ]}
          />
        ) : (
          <AdminEmpty>{t("tokens.missing")}</AdminEmpty>
        )}
        <form action={grantWorkspaceTokensAction} className="mt-6 space-y-4">
          <input name="workspaceId" type="hidden" value={detail.id} />
          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="grant-amount">{t("grant.amountLabel")}</Label>
              <Input
                id="grant-amount"
                inputMode="numeric"
                max={10000000}
                min={1}
                name="amount"
                required
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-note">{t("grant.noteLabel")}</Label>
              <Input
                id="grant-note"
                maxLength={200}
                name="note"
                placeholder={t("grant.notePlaceholder")}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("grant.hint")}</p>
          <SubmitButton size="sm">{t("grant.submit")}</SubmitButton>
        </form>
      </AdminSection>

      <AdminSection description={t("usageDescription")} title={t("usageTitle")}>
        <AdminAiChart data={aiMonitor.byDay} />
        {aiMonitor.grants.length === 0 ? (
          <div className="mt-6">
            <AdminEmpty>{t("grantsEmpty")}</AdminEmpty>
          </div>
        ) : (
          <div className="mt-6">
            <AdminMiniTable
              headers={[
                t("columns.trigger"),
                t("columns.tokens"),
                t("columns.note"),
                t("columns.when"),
              ]}
              rows={aiMonitor.grants.map((grant) => [
                t(`grantTrigger.${grant.trigger}`),
                formatTokenCount(grant.tokens),
                grant.note ?? "—",
                <span key="at" className="whitespace-nowrap tabular-nums">
                  {format.dateTime(grant.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>,
              ])}
            />
          </div>
        )}
      </AdminSection>

      <AdminSection title={t("membersTitle")}>
        {detail.members.length === 0 ? (
          <AdminEmpty>{t("noMembers")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.member"),
              t("columns.role"),
              t("columns.joined"),
              "",
            ]}
            rows={detail.members.map((member) => [
              <Link
                key="user"
                className="hover:underline"
                href={`/admin/users/${member.userId}`}
              >
                <span className="block">{member.name || member.email}</span>
                <span className="block text-xs text-muted-foreground">
                  {member.email}
                </span>
              </Link>,
              <Badge key="role" variant="secondary">
                {member.role}
              </Badge>,
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(member.joinedAt, { dateStyle: "medium" })}
              </span>,
              <form key="remove" action={removeWorkspaceMemberAction}>
                <input name="workspaceId" type="hidden" value={detail.id} />
                <input name="userId" type="hidden" value={member.userId} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.removeMember")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection
        title={t("invitesTitle")}
        description={t("invitesDescription")}
      >
        {detail.pendingInvites.length === 0 ? (
          <AdminEmpty>{t("noInvites")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.email"),
              t("columns.role"),
              t("columns.invitedBy"),
              t("columns.expires"),
              "",
            ]}
            rows={detail.pendingInvites.map((invite) => [
              invite.email,
              invite.role ?? "—",
              invite.inviterEmail ?? "—",
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(invite.expiresAt, { dateStyle: "medium" })}
              </span>,
              <form key="cancel" action={cancelWorkspaceInviteAction}>
                <input name="workspaceId" type="hidden" value={detail.id} />
                <input name="invitationId" type="hidden" value={invite.id} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.cancelInvite")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection title={t("issuersTitle")}>
        {detail.issuers.length === 0 ? (
          <AdminEmpty>{t("noIssuers")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[t("columns.issuer"), t("columns.ico")]}
            rows={detail.issuers.map((issuer) => [
              <Link
                key={issuer.id}
                className="hover:underline"
                href={`/admin/issuers/${issuer.id}`}
              >
                {issuer.name}
              </Link>,
              issuer.ico ?? "—",
            ])}
          />
        )}
      </AdminSection>

      <AdminSection title={t("auditTitle")} description={t("auditDescription")}>
        <AdminAuditList events={detail.auditEvents} />
      </AdminSection>

      <AdminSection
        className="border-destructive/40"
        title={t("dangerTitle")}
        description={t("dangerDescription")}
      >
        <form action={renameWorkspaceAction} className="space-y-3">
          <input name="workspaceId" type="hidden" value={detail.id} />
          <div className="space-y-2">
            <Label htmlFor="rename-name">{t("rename.label")}</Label>
            <Input
              defaultValue={detail.name}
              id="rename-name"
              name="name"
              required
            />
          </div>
          <SubmitButton size="sm" variant="outline">
            {t("rename.submit")}
          </SubmitButton>
        </form>

        <form
          action={deleteWorkspaceAction}
          className="mt-8 space-y-3 border-t pt-6"
        >
          <input name="workspaceId" type="hidden" value={detail.id} />
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              {t("delete.label", { slug: detail.slug })}
            </Label>
            <Input
              autoComplete="off"
              id="delete-confirmation"
              name="confirmation"
              placeholder={detail.slug}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("delete.hint", { count: format.number(detail.invoiceCount) })}
          </p>
          <SubmitButton size="sm" variant="destructive">
            {t("delete.submit")}
          </SubmitButton>
        </form>
      </AdminSection>
    </div>
  );
}
