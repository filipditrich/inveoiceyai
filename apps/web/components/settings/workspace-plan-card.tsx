import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { CheckIcon, MinusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { Entitlements } from "@/lib/entitlements/entitlements";

/**
 * What the workspace's plan actually allows, in the product rather than the
 * admin console. Read-only: plans are activated by platform admin, so there is
 * nothing here for the owner to change yet — the card exists so a blocked
 * action has somewhere to point.
 */
export async function WorkspacePlanCard({
  planName,
  entitlements,
}: {
  planName: string;
  entitlements: Entitlements;
}) {
  const t = await getTranslations("App.settings.workspace.plan");

  const limit = (max: number | null) =>
    max === null ? t("unlimited") : String(max);

  // `as const` keeps the keys literal so `t()` can check them against the
  // catalog; a `string[]` would widen them to `features.${string}`.
  const features = [
    ["bankConnections", entitlements.features.bankConnections],
    ["recurring", entitlements.features.recurring],
    ["historicalImport", entitlements.features.historicalImport],
    ["agents", entitlements.features.agents],
    ["catalogLooks", entitlements.looks.apply === "catalog"],
  ] as const;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <Badge variant="secondary">{planName}</Badge>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
          {(
            [
              ["seats", limit(entitlements.seats.max)],
              ["issuers", limit(entitlements.issuers.max)],
              [
                "monthlyTokens",
                formatTokenCount(entitlements.ai.monthlyIncludedTokens),
              ],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <dt className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                {t(`limits.${key}`)}
              </dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        <ul className="grid gap-2 sm:grid-cols-2">
          {features.map(([key, enabled]) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              {enabled ? (
                <CheckIcon className="size-4 shrink-0 text-primary" />
              ) : (
                <MinusIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={enabled ? undefined : "text-muted-foreground"}>
                {t(`features.${key}`)}
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">{t("contact")}</p>
      </CardContent>
    </Card>
  );
}
