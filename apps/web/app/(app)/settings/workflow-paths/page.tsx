import {
  createWorkflowPathAction,
  deleteWorkflowPathAction,
} from "@/actions/workflow-paths";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import { workflowPathSteps, workflowPaths } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { asc, eq } from "drizzle-orm";
import { GitBranchIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

const SELECT_CLASS =
  "border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm";

export default async function WorkflowPathsPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const t = await getTranslations("Settings.workflowPaths");
  const tErrors = await getTranslations("Errors.invalid");
  const { workspaceId, role } = await requireWorkspace();
  const sp = await searchParams;
  const canAdmin = role === "admin" || role === "owner";
  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;

  const paths = await db
    .select()
    .from(workflowPaths)
    .where(eq(workflowPaths.workspaceId, workspaceId))
    .orderBy(asc(workflowPaths.stage), asc(workflowPaths.name));
  const steps = await db
    .select({ pathId: workflowPathSteps.pathId })
    .from(workflowPathSteps)
    .where(eq(workflowPathSteps.workspaceId, workspaceId));
  const stepCount = new Map<string, number>();
  for (const step of steps) {
    stepCount.set(step.pathId, (stepCount.get(step.pathId) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <SettingsPageHeader
        description={t("subtitle")}
        icon={<GitBranchIcon />}
        title={t("title")}
      />
      {err ? (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      ) : null}

      <section className="space-y-3">
        {paths.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : null}
        {paths.map((path) => (
          <div
            className="bg-card space-y-2 rounded-xl border p-4"
            key={path.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                className="font-medium underline-offset-2 hover:underline"
                href={`/settings/workflow-paths/${path.id}`}
              >
                {path.name}
              </Link>
              <span className="flex flex-wrap gap-1">
                <Badge variant="outline">
                  {path.stage === "validation"
                    ? t("stageValidation")
                    : t("stageApproval")}
                </Badge>
                {path.isFallback ? <Badge>{t("isFallback")}</Badge> : null}
                {path.isActive ? null : (
                  <Badge variant="secondary">{t("inactive")}</Badge>
                )}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              {path.autoApprove
                ? t("autoApproveSummary", {
                    max: path.autoApproveMaxTotal ?? "—",
                    currency: path.autoApproveCurrency ?? "—",
                  })
                : t("stepCount", {
                    count: String(stepCount.get(path.id) ?? 0),
                  })}
            </p>
            {canAdmin ? (
              <form action={deleteWorkflowPathAction}>
                <input name="id" type="hidden" value={path.id} />
                <Button size="sm" type="submit" variant="ghost">
                  {t("deletePath")}
                </Button>
              </form>
            ) : null}
          </div>
        ))}

        {canAdmin ? (
          <form
            action={createWorkflowPathAction}
            className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="path-name">{t("name")}</Label>
              <Input id="path-name" name="name" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="path-stage">{t("stage")}</Label>
              <select
                className={SELECT_CLASS}
                defaultValue="approval"
                id="path-stage"
                name="stage"
              >
                <option value="approval">{t("stageApproval")}</option>
                <option value="validation">{t("stageValidation")}</option>
              </select>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="path-description">{t("description")}</Label>
              <Input id="path-description" name="description" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input defaultChecked name="fourEyes" type="checkbox" />
              {t("fourEyes")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="autoApprove" type="checkbox" />
              {t("autoApprove")}
            </label>
            <div className="grid gap-1.5">
              <Label htmlFor="path-max">{t("maxTotal")}</Label>
              <Input
                id="path-max"
                inputMode="decimal"
                name="autoApproveMaxTotal"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="path-currency">{t("currency")}</Label>
              <select
                className={SELECT_CLASS}
                defaultValue="CZK"
                id="path-currency"
                name="autoApproveCurrency"
              >
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <p className="text-muted-foreground text-xs sm:col-span-2">
              {t("autoApproveHint")}
            </p>
            <div className="sm:col-span-2">
              <Button type="submit">{t("createPath")}</Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
