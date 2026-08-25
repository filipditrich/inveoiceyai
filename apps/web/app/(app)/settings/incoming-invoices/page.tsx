import { deleteApprovalRuleAction } from "@/actions/incoming-approvals";
import {
  ensurePrimaryInboxAlias,
  rotateInboxAliasAction,
} from "@/actions/inbox-aliases";
import { AliasHistoryList } from "@/components/incoming-invoices/alias-history-list";
import { ApprovalRuleForm } from "@/components/incoming-invoices/approval-rule-form";
import { CopyInboxAddress } from "@/components/incoming-invoices/copy-inbox-address";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { describeApprovalRule } from "@/lib/incoming-invoices/rule-summary";
import { invalidMessage } from "@/lib/invalid-message";
import { approvalRules, inboxAliases, workflowPaths } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { InboxIcon } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function IncomingInvoiceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const [t, tErrors, { workspaceId, role }, sp] = await Promise.all([
    getTranslations("Settings.incomingInvoices"),
    getTranslations("Errors.invalid"),
    requireWorkspace(),
    searchParams,
  ]);
  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;
  await ensurePrimaryInboxAlias();
  const aliases = await db
    .select()
    .from(inboxAliases)
    .where(eq(inboxAliases.workspaceId, workspaceId))
    .orderBy(desc(inboxAliases.createdAt));
  const rules = await db
    .select()
    .from(approvalRules)
    .where(eq(approvalRules.workspaceId, workspaceId))
    .orderBy(asc(approvalRules.priority), asc(approvalRules.createdAt));
  const paths = await db
    .select({ id: workflowPaths.id, name: workflowPaths.name })
    .from(workflowPaths)
    .where(
      and(
        eq(workflowPaths.workspaceId, workspaceId),
        eq(workflowPaths.stage, "approval"),
        eq(workflowPaths.isActive, true),
      ),
    )
    .orderBy(asc(workflowPaths.name));
  const pathNameById = new Map(paths.map((path) => [path.id, path.name]));
  const domain =
    env.INVOICEY_INBOUND_EMAIL_DOMAIN ?? "inbox.invoicey.ditrich.me";
  const canAdmin = role === "admin" || role === "owner";
  const current = aliases.find((alias) => alias.isActive) ?? null;
  const history = aliases.filter((alias) => !alias.isActive);
  const currentAddress = current ? `${current.localPart}@${domain}` : null;

  return (
    <div className="space-y-8">
      <SettingsPageHeader
        icon={<InboxIcon />}
        title={t("title")}
        description={t("subtitle")}
      />
      {err ? (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("aliasTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("aliasWarning")}</p>
        {current && currentAddress ? (
          <div className="bg-card space-y-3 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              {t("currentAddress")}
            </p>
            <code className="block break-all text-base">{currentAddress}</code>
            <div className="flex flex-wrap gap-2">
              <Badge>{t("active")}</Badge>
              <CopyInboxAddress address={currentAddress} />
              {canAdmin ? (
                <form action={rotateInboxAliasAction}>
                  <input type="hidden" name="id" value={current.id} />
                  <Button type="submit" variant="outline">
                    {t("rotate")}
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}
        {history.length > 0 ? (
          <AliasHistoryList
            addresses={history.map((alias) => `${alias.localPart}@${domain}`)}
          />
        ) : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("rulesTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("rulesHint")}</p>
        {rules.map((rule) => {
          const summary = describeApprovalRule(rule.conditions);
          const pathName = rule.pathId
            ? (pathNameById.get(rule.pathId) ?? t("ruleMissingPath"))
            : t("ruleMissingPath");
          return (
            <div
              className="bg-card space-y-2 rounded-xl border p-4"
              key={rule.id}
            >
              <div className="flex items-center justify-between gap-2">
                <strong>{rule.name}</strong>
                <Badge variant="outline">
                  {t("priorityValue", { value: String(rule.priority) })}
                </Badge>
              </div>
              <p className="text-sm">{t("ruleUsesPath", { path: pathName })}</p>
              {summary.currency ? (
                <p className="text-muted-foreground text-sm">
                  {t("ruleWhenCurrency", { currency: summary.currency })}
                </p>
              ) : null}
              {canAdmin ? (
                <form action={deleteApprovalRuleAction}>
                  <input name="id" type="hidden" value={rule.id} />
                  <Button size="sm" type="submit" variant="ghost">
                    {t("deleteRule")}
                  </Button>
                </form>
              ) : null}
            </div>
          );
        })}
        {canAdmin ? (
          paths.length > 0 ? (
            <ApprovalRuleForm
              paths={paths.map((path) => ({ id: path.id, name: path.name }))}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("rulesNeedPath")}{" "}
              <Link
                className="text-brand underline-offset-2 hover:underline"
                href="/settings/workflow-paths"
              >
                {t("managePaths")}
              </Link>
            </p>
          )
        ) : null}
      </section>
    </div>
  );
}
