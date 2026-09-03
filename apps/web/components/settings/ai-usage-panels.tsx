"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";

import { AiUsageChart, type UsageDayPoint } from "./ai-usage-chart";

export type UsageBalanceProps = {
  giftedRemaining: number;
  monthlyRemaining: number;
  monthlyLimit: number;
  purchasedRemaining: number;
  totalAvailable: number;
  daysUntilRenewal: number;
  periodEndIso: string;
  monthlyIncluded: number;
};

/** One row of the grant ledger (ADR 0037) — how a balance came to be. */
export type UsageGrantRow = {
  id: string;
  /** Literal union so the catalog key stays checkable. */
  trigger: "signup" | "first_invoice_issued" | "manual";
  tokens: number;
  note: string | null;
  createdAtIso: string;
};

export type UsageHistoryRow = {
  id: string;
  product: string;
  kind: string;
  model: string | null;
  totalTokens: number;
  toolName: string | null;
  createdAtIso: string;
};

export function AiUsagePanels({
  balance,
  chart,
  history,
  grants,
  topUpEnabled,
}: {
  balance: UsageBalanceProps;
  chart: UsageDayPoint[];
  history: UsageHistoryRow[];
  grants: UsageGrantRow[];
  /** Plan entitlement. A sponsored plan pays for its own tokens (ADR 0035). */
  topUpEnabled: boolean;
}) {
  const t = useTranslations("App.settings.usage");
  const format = useFormatter();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t("plan.title")}</CardTitle>
              <CardDescription>{t("plan.description")}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                render={<Link href="/settings/workspace/billing" />}
                type="button"
                variant="outline"
              >
                {t("plan.viewPlans")}
              </Button>
              <Button render={<Link href="/settings/workspace/billing" />}>
                {t("plan.upgrade")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="text-lg font-medium">{t("plan.freeName")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("plan.freeIncludes", {
              monthly: formatTokenCount(balance.monthlyIncluded),
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t("balance.title")}</CardTitle>
              <CardDescription>
                {t("balance.renewal", { days: balance.daysUntilRenewal })}
              </CardDescription>
            </div>
            <Button
              render={<Link href="/settings/workspace/billing" />}
              variant="outline"
            >
              {t("plan.upgrade")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-5 md:grid-cols-[minmax(0,220px)_1fr]">
          <div className="flex flex-col justify-between rounded-xl bg-foreground p-5 text-background">
            <p className="text-xs tracking-wide uppercase opacity-70">
              {t("balance.cardLabel")}
            </p>
            <p className="mt-6 text-3xl font-semibold tracking-tight">
              {formatTokenCount(balance.totalAvailable)}
            </p>
            <p className="mt-2 text-xs opacity-70">{t("balance.totalLabel")}</p>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("balance.gifted")}</dt>
              <dd className="font-medium">
                {formatTokenCount(balance.giftedRemaining)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("balance.monthly")}</dt>
              <dd className="font-medium">
                {formatTokenCount(balance.monthlyRemaining)} /{" "}
                {formatTokenCount(balance.monthlyLimit)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t("balance.purchased")}
              </dt>
              <dd className="font-medium">
                {formatTokenCount(balance.purchasedRemaining)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <dt className="font-medium">{t("balance.totalLabel")}</dt>
              <dd className="font-semibold">
                {formatTokenCount(balance.totalAvailable)}
              </dd>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("balance.noRollover")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("balance.expiresOn", {
                date: format.dateTime(new Date(balance.periodEndIso), {
                  dateStyle: "medium",
                }),
              })}
            </p>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("chart.title")}</CardTitle>
          <CardDescription>{t("chart.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <AiUsageChart data={chart} />
          <p className="mt-3 text-xs text-muted-foreground">
            {t("chart.mcpNote")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("history.title")}</CardTitle>
          <CardDescription>{t("history.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {history.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t("history.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("history.when")}</TableHead>
                  <TableHead>{t("history.product")}</TableHead>
                  <TableHead>{t("history.detail")}</TableHead>
                  <TableHead className="text-right">
                    {t("history.tokens")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(new Date(row.createdAtIso), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      {t(`products.${row.product}` as never)}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {row.kind === "tool_call"
                        ? (row.toolName ?? "—")
                        : (row.model ?? "llm")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.kind === "tool_call"
                        ? "—"
                        : formatTokenCount(row.totalTokens)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {grants.length > 0 ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("grants.title")}</CardTitle>
            <CardDescription>{t("grants.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("grants.columns.reason")}</TableHead>
                  <TableHead>{t("grants.columns.tokens")}</TableHead>
                  <TableHead>{t("grants.columns.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.map((grant) => (
                  <TableRow key={grant.id}>
                    <TableCell>
                      {t(`grants.trigger.${grant.trigger}`)}
                      {grant.note ? (
                        <span className="block text-xs text-muted-foreground">
                          {grant.note}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">
                      +{formatTokenCount(grant.tokens)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format.dateTime(new Date(grant.createdAtIso), {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {topUpEnabled ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("topup.title")}</CardTitle>
            <CardDescription>{t("topup.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap gap-2">
              <Button render={<Link href="/settings/workspace/billing" />}>
                {t("topup.buy")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("topup.billingHint")}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
