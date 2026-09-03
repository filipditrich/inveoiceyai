import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTranslations } from "next-intl/server";

import type { Entitlements } from "@invoicey/db";

/** `null` is unlimited, and the input has to be able to express that. */
const limitValue = (max: number | null) => (max === null ? "" : String(max));

export async function AdminEntitlementFields({
  entitlements,
  idPrefix = "",
}: {
  entitlements: Entitlements;
  idPrefix?: string;
}) {
  const t = await getTranslations("Admin.planDetail");
  const e = entitlements;
  const id = (name: string) => `${idPrefix}${name}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={id("seatsMax")}>{t("fields.seats")}</Label>
          <Input
            defaultValue={limitValue(e.seats.max)}
            id={id("seatsMax")}
            inputMode="numeric"
            name="seatsMax"
            placeholder={t("unlimitedPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("issuersMax")}>{t("fields.issuers")}</Label>
          <Input
            defaultValue={limitValue(e.issuers.max)}
            id={id("issuersMax")}
            inputMode="numeric"
            name="issuersMax"
            placeholder={t("unlimitedPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("monthlyIncludedTokens")}>
            {t("fields.monthlyTokens")}
          </Label>
          <Input
            defaultValue={String(e.ai.monthlyIncludedTokens)}
            id={id("monthlyIncludedTokens")}
            inputMode="numeric"
            min={0}
            name="monthlyIncludedTokens"
            required
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("auditRetentionDays")}>
            {t("fields.auditRetention")}
          </Label>
          <Input
            defaultValue={limitValue(e.audit.retentionDays)}
            id={id("auditRetentionDays")}
            inputMode="numeric"
            name="auditRetentionDays"
            placeholder={t("foreverPlaceholder")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("clientsCreateMode")}>
            {t("fields.clientMode")}
          </Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={e.clients.createMode}
            id={id("clientsCreateMode")}
            name="clientsCreateMode"
          >
            <option value="open">{t("clientMode.open")}</option>
            <option value="managed">{t("clientMode.managed")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("permissionsMode")}>
            {t("fields.permissions")}
          </Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={e.permissions.mode}
            id={id("permissionsMode")}
            name="permissionsMode"
          >
            <option value="off">{t("permissionsMode.off")}</option>
            <option value="roles">{t("permissionsMode.roles")}</option>
            <option value="advanced">{t("permissionsMode.advanced")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("looksApply")}>{t("fields.looks")}</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={e.looks.apply}
            id={id("looksApply")}
            name="looksApply"
          >
            <option value="classic">{t("looksApply.classic")}</option>
            <option value="catalog">{t("looksApply.catalog")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("allowedEmailDomains")}>
            {t("fields.allowedDomains")}
          </Label>
          <Input
            defaultValue={e.auth.allowedEmailDomains.join(", ")}
            id={id("allowedEmailDomains")}
            name="allowedEmailDomains"
          />
          <p className="text-xs text-muted-foreground">
            {t("hints.allowedDomains")}
          </p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("fields.features")}</legend>
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
              <Checkbox defaultChecked={value} id={id(name)} name={name} />
              <Label className="font-normal" htmlFor={id(name)}>
                {t(`features.${name}`)}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
