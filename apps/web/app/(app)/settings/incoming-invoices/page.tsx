import {
  deleteApprovalRuleAction,
  saveApprovalRuleAction,
} from "@/actions/incoming-approvals";
import {
  ensurePrimaryInboxAlias,
  rotateInboxAliasAction,
} from "@/actions/inbox-aliases";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InboxIcon } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/session";
import { env } from "@invoicey/env/server";
import { approvalRules, inboxAliases } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { asc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

export default async function IncomingInvoiceSettingsPage() {
  const [t, { workspaceId, role }] = await Promise.all([
    getTranslations("Settings.incomingInvoices"),
    requireWorkspace(),
  ]);
  await ensurePrimaryInboxAlias();
  const aliases = await db
    .select()
    .from(inboxAliases)
    .where(eq(inboxAliases.workspaceId, workspaceId));
  const rules = await db
    .select()
    .from(approvalRules)
    .where(eq(approvalRules.workspaceId, workspaceId))
    .orderBy(asc(approvalRules.priority));
  const domain =
    env.INVOICEY_INBOUND_EMAIL_DOMAIN ?? "inbox.invoicey.ditrich.me";
  const canAdmin = role === "admin" || role === "owner";

  return (
    <div className="space-y-8">
      <SettingsPageHeader
        icon={<InboxIcon />}
        title={t("title")}
        description={t("subtitle")}
      />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("aliasTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("aliasWarning")}</p>
        <ul className="space-y-2">
          {aliases.map((alias) => (
            <li
              key={alias.id}
              className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div>
                <code className="text-sm">
                  {alias.localPart}@{domain}
                </code>
                <div className="mt-1 flex gap-2">
                  <Badge variant={alias.isActive ? "default" : "outline"}>
                    {alias.isActive ? t("active") : t("rotated")}
                  </Badge>
                  {alias.label ? (
                    <Badge variant="secondary">{alias.label}</Badge>
                  ) : null}
                </div>
              </div>
              {alias.isActive && canAdmin ? (
                <form action={rotateInboxAliasAction}>
                  <input type="hidden" name="id" value={alias.id} />
                  <Button type="submit" variant="outline">
                    {t("rotate")}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("rulesTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("rulesHint")}</p>
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-card space-y-2 rounded-xl border p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <strong>{rule.name}</strong>
              <Badge variant="outline">{rule.priority}</Badge>
            </div>
            <pre className="text-muted-foreground overflow-auto text-xs">
              {JSON.stringify(
                { conditions: rule.conditions, path: rule.path },
                null,
                2,
              )}
            </pre>
            {canAdmin ? (
              <form action={deleteApprovalRuleAction}>
                <input type="hidden" name="id" value={rule.id} />
                <Button size="sm" type="submit" variant="ghost">
                  {t("deleteRule")}
                </Button>
              </form>
            ) : null}
          </div>
        ))}
        {canAdmin ? (
          <form
            action={saveApprovalRuleAction}
            className="bg-card grid gap-3 rounded-xl border p-4"
          >
            <input
              name="name"
              required
              placeholder={t("ruleName")}
              className="border-input rounded-md border px-2 py-1.5"
            />
            <input
              name="priority"
              type="number"
              defaultValue={100}
              className="border-input rounded-md border px-2 py-1.5"
            />
            <textarea
              name="conditions"
              required
              rows={6}
              defaultValue={JSON.stringify(
                {
                  version: 1,
                  all: [{ fact: "currency", op: "eq", value: "CZK" }],
                },
                null,
                2,
              )}
              className="border-input rounded-md border px-2 py-1.5 font-mono text-xs"
            />
            <textarea
              name="path"
              required
              rows={4}
              defaultValue={JSON.stringify(
                { type: "auto_approve", maxTotal: "5000", currency: "CZK" },
                null,
                2,
              )}
              className="border-input rounded-md border px-2 py-1.5 font-mono text-xs"
            />
            <Button type="submit">{t("saveRule")}</Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
