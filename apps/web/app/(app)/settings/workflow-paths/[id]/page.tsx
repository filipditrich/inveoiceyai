import {
  addPathStepAction,
  addStepApproverAction,
  deletePathStepAction,
  movePathStepAction,
  removeStepApproverAction,
  updateWorkflowPathAction,
} from "@/actions/workflow-paths";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import {
  member,
  teams,
  user,
  workflowPathStepApprovers,
  workflowPathSteps,
  workflowPaths,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, asc, eq, inArray } from "drizzle-orm";
import { GitBranchIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const SELECT_CLASS =
  "border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm";

export default async function WorkflowPathDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Settings.workflowPaths");
  const tErrors = await getTranslations("Errors.invalid");
  const { workspaceId, role } = await requireWorkspace();
  const sp = await searchParams;
  const canAdmin = role === "admin" || role === "owner";
  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;

  const [path] = await db
    .select()
    .from(workflowPaths)
    .where(
      and(eq(workflowPaths.id, id), eq(workflowPaths.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!path) notFound();

  const steps = await db
    .select()
    .from(workflowPathSteps)
    .where(eq(workflowPathSteps.pathId, path.id))
    .orderBy(asc(workflowPathSteps.position));
  const approvers = steps.length
    ? await db
        .select()
        .from(workflowPathStepApprovers)
        .where(
          inArray(
            workflowPathStepApprovers.stepId,
            steps.map((step) => step.id),
          ),
        )
    : [];
  const workspaceTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.workspaceId, workspaceId))
    .orderBy(asc(teams.name));
  const people = await db
    .select({ userId: member.userId, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, workspaceId))
    .orderBy(asc(user.name));

  const personName = new Map(
    people.map((row) => [row.userId, row.name ?? row.email]),
  );
  const teamName = new Map(workspaceTeams.map((row) => [row.id, row.name]));

  return (
    <div className="space-y-8">
      <SettingsPageHeader
        description={t("detailSubtitle")}
        icon={<GitBranchIcon />}
        title={path.name}
      />
      <Link
        className="text-brand text-sm underline-offset-2 hover:underline"
        href="/settings/workflow-paths"
      >
        {t("backToPaths")}
      </Link>
      {err ? (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      ) : null}

      {canAdmin ? (
        <form
          action={updateWorkflowPathAction}
          className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
        >
          <input name="id" type="hidden" value={path.id} />
          <div className="grid gap-1.5">
            <Label htmlFor="path-name">{t("name")}</Label>
            <Input defaultValue={path.name} id="path-name" name="name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="path-description">{t("description")}</Label>
            <Input
              defaultValue={path.description ?? ""}
              id="path-description"
              name="description"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="path-reminder">{t("reminderAfterDays")}</Label>
            <Input
              defaultValue={path.reminderAfterDays ?? ""}
              id="path-reminder"
              min={1}
              name="reminderAfterDays"
              type="number"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="path-escalate">{t("escalateAfterDays")}</Label>
            <Input
              defaultValue={path.escalateAfterDays ?? ""}
              id="path-escalate"
              min={1}
              name="escalateAfterDays"
              type="number"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={path.fourEyes}
              name="fourEyes"
              type="checkbox"
            />
            {t("fourEyes")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={path.isActive}
              name="isActive"
              type="checkbox"
            />
            {t("active")}
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              defaultChecked={path.isFallback}
              name="isFallback"
              type="checkbox"
            />
            {t("isFallbackHint")}
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">{t("savePath")}</Button>
          </div>
        </form>
      ) : null}

      {path.autoApprove ? (
        <p className="text-muted-foreground text-sm">
          {t("autoApproveSummary", {
            max: path.autoApproveMaxTotal ?? "—",
            currency: path.autoApproveCurrency ?? "—",
          })}
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("steps")}</h2>
          {steps.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("stepsEmpty")}</p>
          ) : null}

          {steps.map((step, index) => {
            const stepApprovers = approvers.filter(
              (row) => row.stepId === step.id,
            );
            return (
              <div
                className="bg-card space-y-3 rounded-xl border p-4"
                key={step.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {t("stepTitle", {
                      position: String(step.position),
                      mode: t(
                        step.mode === "all_of"
                          ? "modeAllOf"
                          : step.mode === "quorum"
                            ? "modeQuorum"
                            : "modeAnyOne",
                      ),
                    })}
                  </strong>
                  {step.mode === "quorum" ? (
                    <Badge variant="outline">
                      {t("quorumBadge", { count: String(step.quorum ?? 1) })}
                    </Badge>
                  ) : null}
                </div>

                <ul className="flex flex-wrap gap-2">
                  {stepApprovers.map((approver) => (
                    <li
                      className="bg-muted/50 flex items-center gap-2 rounded-lg px-2 py-1 text-sm"
                      key={approver.id}
                    >
                      <span>
                        {approver.kind === "user"
                          ? (personName.get(approver.userId ?? "") ?? "—")
                          : approver.kind === "team"
                            ? t("teamLabel", {
                                name:
                                  teamName.get(approver.teamId ?? "") ?? "—",
                              })
                            : approver.kind === "role"
                              ? t("roleLabel", { role: approver.role ?? "—" })
                              : t("dynamicLabel", {
                                  which: approver.dynamic ?? "—",
                                })}
                      </span>
                      {canAdmin ? (
                        <form action={removeStepApproverAction}>
                          <input name="id" type="hidden" value={approver.id} />
                          <input name="pathId" type="hidden" value={path.id} />
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            type="submit"
                          >
                            ×
                            <span className="sr-only">
                              {t("removeApprover")}
                            </span>
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                  {stepApprovers.length === 0 ? (
                    <li className="text-destructive text-sm">
                      {t("approversEmpty")}
                    </li>
                  ) : null}
                </ul>

                {canAdmin ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <form
                      action={addStepApproverAction}
                      className="flex items-end gap-2"
                    >
                      <input name="stepId" type="hidden" value={step.id} />
                      <input name="pathId" type="hidden" value={path.id} />
                      <label className="grid gap-1 text-sm">
                        <span className="sr-only">{t("addApprover")}</span>
                        <select className={SELECT_CLASS} name="approver">
                          <optgroup label={t("groupTeams")}>
                            {workspaceTeams.map((team) => (
                              <option key={team.id} value={`team:${team.id}`}>
                                {team.name}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={t("groupPeople")}>
                            {people.map((person) => (
                              <option
                                key={person.userId}
                                value={`user:${person.userId}`}
                              >
                                {person.name ?? person.email}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={t("groupRoles")}>
                            <option value="role:owner">owner</option>
                            <option value="role:admin">admin</option>
                          </optgroup>
                        </select>
                      </label>
                      <Button size="sm" type="submit" variant="outline">
                        {t("addApprover")}
                      </Button>
                    </form>

                    <form action={movePathStepAction}>
                      <input name="id" type="hidden" value={step.id} />
                      <input name="pathId" type="hidden" value={path.id} />
                      <input name="direction" type="hidden" value="up" />
                      <Button
                        disabled={index === 0}
                        size="sm"
                        type="submit"
                        variant="ghost"
                      >
                        {t("moveUp")}
                      </Button>
                    </form>
                    <form action={movePathStepAction}>
                      <input name="id" type="hidden" value={step.id} />
                      <input name="pathId" type="hidden" value={path.id} />
                      <input name="direction" type="hidden" value="down" />
                      <Button
                        disabled={index === steps.length - 1}
                        size="sm"
                        type="submit"
                        variant="ghost"
                      >
                        {t("moveDown")}
                      </Button>
                    </form>
                    <form action={deletePathStepAction}>
                      <input name="id" type="hidden" value={step.id} />
                      <input name="pathId" type="hidden" value={path.id} />
                      <Button size="sm" type="submit" variant="ghost">
                        {t("deleteStep")}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            );
          })}

          {canAdmin ? (
            <form
              action={addPathStepAction}
              className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4"
            >
              <input name="pathId" type="hidden" value={path.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="step-mode">{t("mode")}</Label>
                <select
                  className={SELECT_CLASS}
                  defaultValue="any_one"
                  id="step-mode"
                  name="mode"
                >
                  <option value="any_one">{t("modeAnyOne")}</option>
                  <option value="all_of">{t("modeAllOf")}</option>
                  <option value="quorum">{t("modeQuorum")}</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="step-quorum">{t("quorum")}</Label>
                <Input id="step-quorum" min={1} name="quorum" type="number" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="step-label">{t("stepLabel")}</Label>
                <Input id="step-label" name="label" />
              </div>
              <Button type="submit">{t("addStep")}</Button>
            </form>
          ) : null}
        </section>
      )}
    </div>
  );
}
