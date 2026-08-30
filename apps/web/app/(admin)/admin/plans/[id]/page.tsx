import { ArrowLeftIcon, LayersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  addPlanClientAction,
  removePlanClientAction,
} from "@/actions/admin-plan-clients";
import { updatePlanEntitlementsAction } from "@/actions/admin-plans";
import {
  AdminEmpty,
  AdminFacts,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { adminGetPlan } from "@/lib/admin/plans";
import { listPlanClients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { requirePlatformAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** `null` is unlimited, and the input has to be able to express that. */
const limitValue = (max: number | null) => (max === null ? "" : String(max));

export default async function AdminPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [t, plan] = await Promise.all([
    getTranslations("Admin.planDetail"),
    adminGetPlan(id),
  ]);

  if (!plan) {
    notFound();
  }

  const e = plan.entitlements;
  const catalog = await listPlanClients(db, plan.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
        href="/admin/plans"
      >
        <ArrowLeftIcon className="size-4" />
        {t("back")}
      </Link>

      <PageHeader
        description={plan.key}
        eyebrow={t("eyebrow")}
        icon={<LayersIcon className="size-5" />}
        title={plan.name}
      />

      <AdminSection title={t("overviewTitle")}>
        <AdminFacts
          items={[
            {
              label: t("facts.kind"),
              value: (
                <Badge
                  variant={plan.kind === "custom" ? "outline" : "secondary"}
                >
                  {t(`kind.${plan.kind}`)}
                </Badge>
              ),
            },
            { label: t("facts.workspaces"), value: plan.workspaceCount },
            {
              label: t("facts.grants"),
              value:
                e.ai.grants.length === 0
                  ? t("noGrants")
                  : e.ai.grants
                      .map(
                        (grant) =>
                          `${t(`trigger.${grant.trigger}`)}: ${formatTokenCount(grant.tokens)}`,
                      )
                      .join(" · "),
            },
          ]}
        />
      </AdminSection>

      <AdminSection description={t("editHint")} title={t("editTitle")}>
        {/* Every workspace on this plan moves at once — that is the point of
            the shared row, and the count above is the warning. */}
        {plan.workspaceCount > 0 ? (
          <p className="text-muted-foreground mb-6 text-sm">
            {t("affects", { count: plan.workspaceCount })}
          </p>
        ) : null}

        <form action={updatePlanEntitlementsAction} className="space-y-6">
          <input name="planId" type="hidden" value={plan.id} />
          {/* Grant rules ride along untouched: their keys are idempotency
              identifiers and editing one re-grants to every workspace. */}
          <input
            name="currentEntitlements"
            type="hidden"
            value={JSON.stringify(e)}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="seatsMax">{t("fields.seats")}</Label>
              <Input
                defaultValue={limitValue(e.seats.max)}
                id="seatsMax"
                inputMode="numeric"
                name="seatsMax"
                placeholder={t("unlimitedPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuersMax">{t("fields.issuers")}</Label>
              <Input
                defaultValue={limitValue(e.issuers.max)}
                id="issuersMax"
                inputMode="numeric"
                name="issuersMax"
                placeholder={t("unlimitedPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyIncludedTokens">
                {t("fields.monthlyTokens")}
              </Label>
              <Input
                defaultValue={String(e.ai.monthlyIncludedTokens)}
                id="monthlyIncludedTokens"
                inputMode="numeric"
                min={0}
                name="monthlyIncludedTokens"
                required
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auditRetentionDays">
                {t("fields.auditRetention")}
              </Label>
              <Input
                defaultValue={limitValue(e.audit.retentionDays)}
                id="auditRetentionDays"
                inputMode="numeric"
                name="auditRetentionDays"
                placeholder={t("foreverPlaceholder")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientsCreateMode">
                {t("fields.clientMode")}
              </Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                defaultValue={e.clients.createMode}
                id="clientsCreateMode"
                name="clientsCreateMode"
              >
                <option value="open">{t("clientMode.open")}</option>
                <option value="managed">{t("clientMode.managed")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permissionsMode">{t("fields.permissions")}</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                defaultValue={e.permissions.mode}
                id="permissionsMode"
                name="permissionsMode"
              >
                <option value="off">{t("permissionsMode.off")}</option>
                <option value="roles">{t("permissionsMode.roles")}</option>
                <option value="advanced">
                  {t("permissionsMode.advanced")}
                </option>
              </select>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">
              {t("fields.features")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["bankConnections", e.features.bankConnections],
                  ["recurring", e.features.recurring],
                  ["historicalImport", e.features.historicalImport],
                  ["agents", e.features.agents],
                  ["topUpEnabled", e.ai.topUpEnabled],
                ] as const
              ).map(([name, value]) => (
                <div key={name} className="flex items-center gap-2">
                  <Checkbox defaultChecked={value} id={name} name={name} />
                  <Label className="font-normal" htmlFor={name}>
                    {t(`features.${name}`)}
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="autoAssignEmailDomains">
                {t("fields.autoAssignDomains")}
              </Label>
              <Input
                defaultValue={plan.autoAssignEmailDomains.join(", ")}
                id="autoAssignEmailDomains"
                name="autoAssignEmailDomains"
                placeholder="nfctron.com"
              />
              <p className="text-muted-foreground text-xs">
                {t("hints.autoAssignDomains")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowedEmailDomains">
                {t("fields.allowedDomains")}
              </Label>
              <Input
                defaultValue={e.auth.allowedEmailDomains.join(", ")}
                id="allowedEmailDomains"
                name="allowedEmailDomains"
                placeholder="nfctron.com"
              />
              <p className="text-muted-foreground text-xs">
                {t("hints.allowedDomains")}
              </p>
            </div>
          </div>

          <SubmitButton size="sm">{t("save")}</SubmitButton>
        </form>
      </AdminSection>

      <AdminSection
        description={t("catalog.description")}
        title={t("catalog.title")}
      >
        {e.clients.createMode === "open" ? (
          // Deliberately not hidden: a catalog on an open plan is inert, and
          // saying so is more useful than the section silently vanishing.
          <p className="text-muted-foreground mb-6 text-sm">
            {t("catalog.inactive")}
          </p>
        ) : null}

        {catalog.length === 0 ? (
          <AdminEmpty>{t("catalog.empty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[t("catalog.columns.name"), t("catalog.columns.ico"), ""]}
            rows={catalog.map((entry) => [
              String(entry.snapshot.name ?? "—"),
              entry.ico,
              <form key="remove" action={removePlanClientAction}>
                <input name="planId" type="hidden" value={plan.id} />
                <input name="planClientId" type="hidden" value={entry.id} />
                <SubmitButton size="sm" variant="ghost">
                  {t("catalog.remove")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}

        <form action={addPlanClientAction} className="mt-6 space-y-4">
          <input name="planId" type="hidden" value={plan.id} />
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="ico">{t("catalog.icoLabel")}</Label>
              <Input
                id="ico"
                inputMode="numeric"
                name="ico"
                placeholder="12345678"
                required
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{t("catalog.hint")}</p>
          <SubmitButton size="sm">{t("catalog.add")}</SubmitButton>
        </form>
      </AdminSection>
    </div>
  );
}
