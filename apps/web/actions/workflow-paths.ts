"use server";

import {
  teamMembers,
  teams,
  workflowPathStepApprovers,
  workflowPathSteps,
  workflowPaths,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspaceRole } from "@/lib/auth/session";

function trimmed(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

const PATHS = "/settings/workflow-paths";
const TEAMS = "/settings/teams";

/* ------------------------------------------------------------------ teams */

export async function createTeamAction(formData: FormData): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const name = trimmed(formData.get("name"));
  if (!name) redirect(`${TEAMS}?invalid=required_fields`);
  await db
    .insert(teams)
    .values({
      workspaceId,
      name,
      description: trimmed(formData.get("description")),
      createdByUserId: userId,
    })
    .onConflictDoNothing();
  revalidatePath(TEAMS);
  redirect(`${TEAMS}?toast=team_saved`);
}

export async function deleteTeamAction(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = trimmed(formData.get("id"));
  if (!id) redirect(`${TEAMS}?invalid=missing_id`);
  await db
    .delete(teams)
    .where(and(eq(teams.id, id), eq(teams.workspaceId, workspaceId)));
  revalidatePath(TEAMS);
  redirect(`${TEAMS}?toast=team_deleted`);
}

export async function addTeamMemberAction(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const teamId = trimmed(formData.get("teamId"));
  const memberUserId = trimmed(formData.get("userId"));
  if (!teamId || !memberUserId) redirect(`${TEAMS}?invalid=required_fields`);
  await db
    .insert(teamMembers)
    .values({ workspaceId, teamId, userId: memberUserId })
    .onConflictDoNothing();
  revalidatePath(TEAMS);
  redirect(`${TEAMS}?toast=team_saved`);
}

export async function removeTeamMemberAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = trimmed(formData.get("id"));
  if (!id) redirect(`${TEAMS}?invalid=missing_id`);
  await db
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.workspaceId, workspaceId)),
    );
  revalidatePath(TEAMS);
  redirect(`${TEAMS}?toast=team_saved`);
}

/* ------------------------------------------------------------------ paths */

export async function createWorkflowPathAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const name = trimmed(formData.get("name"));
  const stage =
    trimmed(formData.get("stage")) === "validation" ? "validation" : "approval";
  if (!name) redirect(`${PATHS}?invalid=required_fields`);

  const autoApprove = formData.get("autoApprove") === "on";
  const maxTotal = trimmed(formData.get("autoApproveMaxTotal"));
  const currency = trimmed(formData.get("autoApproveCurrency"));
  if (autoApprove && (!maxTotal || !currency)) {
    redirect(`${PATHS}?invalid=auto_approve_requires_cap`);
  }

  const [created] = await db
    .insert(workflowPaths)
    .values({
      workspaceId,
      name,
      stage,
      description: trimmed(formData.get("description")),
      fourEyes: formData.get("fourEyes") !== "off",
      autoApprove,
      autoApproveMaxTotal: autoApprove ? maxTotal : null,
      autoApproveCurrency: autoApprove ? currency : null,
      createdByUserId: userId,
    })
    .returning({ id: workflowPaths.id });
  revalidatePath(PATHS);
  redirect(created ? `${PATHS}/${created.id}` : `${PATHS}?toast=path_saved`);
}

export async function updateWorkflowPathAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = trimmed(formData.get("id"));
  if (!id) redirect(`${PATHS}?invalid=missing_id`);
  const isFallback = formData.get("isFallback") === "on";

  await db.transaction(async (tx) => {
    const [path] = await tx
      .select()
      .from(workflowPaths)
      .where(
        and(
          eq(workflowPaths.id, id),
          eq(workflowPaths.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!path) return;
    // At most one fallback per stage, so claiming it releases the incumbent.
    if (isFallback) {
      await tx
        .update(workflowPaths)
        .set({ isFallback: false })
        .where(
          and(
            eq(workflowPaths.workspaceId, workspaceId),
            eq(workflowPaths.stage, path.stage),
          ),
        );
    }
    await tx
      .update(workflowPaths)
      .set({
        name: trimmed(formData.get("name")) ?? path.name,
        description: trimmed(formData.get("description")),
        fourEyes: formData.get("fourEyes") !== "off",
        isActive: formData.get("isActive") !== "off",
        isFallback,
        reminderAfterDays: Number(formData.get("reminderAfterDays")) || null,
        escalateAfterDays: Number(formData.get("escalateAfterDays")) || null,
        updatedAt: new Date(),
      })
      .where(eq(workflowPaths.id, id));
  });
  revalidatePath(`${PATHS}/${id}`);
  redirect(`${PATHS}/${id}?toast=path_saved`);
}

export async function deleteWorkflowPathAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = trimmed(formData.get("id"));
  if (!id) redirect(`${PATHS}?invalid=missing_id`);
  await db
    .delete(workflowPaths)
    .where(
      and(eq(workflowPaths.id, id), eq(workflowPaths.workspaceId, workspaceId)),
    );
  revalidatePath(PATHS);
  redirect(`${PATHS}?toast=path_deleted`);
}

/* ------------------------------------------------------------------ steps */

export async function addPathStepAction(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const pathId = trimmed(formData.get("pathId"));
  if (!pathId) redirect(`${PATHS}?invalid=missing_id`);
  const mode = trimmed(formData.get("mode")) ?? "any_one";
  const quorum = Number(formData.get("quorum")) || null;
  if (mode === "quorum" && !quorum) {
    redirect(`${PATHS}/${pathId}?invalid=quorum_requires_count`);
  }

  await db.transaction(async (tx) => {
    const [last] = await tx
      .select({ position: workflowPathSteps.position })
      .from(workflowPathSteps)
      .where(eq(workflowPathSteps.pathId, pathId))
      .orderBy(sql`${workflowPathSteps.position} desc`)
      .limit(1);
    await tx.insert(workflowPathSteps).values({
      workspaceId,
      pathId,
      position: (last?.position ?? 0) + 1,
      mode: mode as "any_one" | "all_of" | "quorum",
      quorum: mode === "quorum" ? quorum : null,
      label: trimmed(formData.get("label")),
    });
  });
  revalidatePath(`${PATHS}/${pathId}`);
  redirect(`${PATHS}/${pathId}?toast=path_saved`);
}

export async function deletePathStepAction(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = trimmed(formData.get("id"));
  const pathId = trimmed(formData.get("pathId"));
  if (!id || !pathId) redirect(`${PATHS}?invalid=missing_id`);
  await db.transaction(async (tx) => {
    await tx
      .delete(workflowPathSteps)
      .where(
        and(
          eq(workflowPathSteps.id, id),
          eq(workflowPathSteps.workspaceId, workspaceId),
        ),
      );
    // Close the gap so positions stay contiguous.
    const rest = await tx
      .select({ id: workflowPathSteps.id })
      .from(workflowPathSteps)
      .where(eq(workflowPathSteps.pathId, pathId))
      .orderBy(asc(workflowPathSteps.position));
    for (const [index, step] of rest.entries()) {
      await tx
        .update(workflowPathSteps)
        .set({ position: index + 1 })
        .where(eq(workflowPathSteps.id, step.id));
    }
  });
  revalidatePath(`${PATHS}/${pathId}`);
  redirect(`${PATHS}/${pathId}?toast=path_saved`);
}

export async function movePathStepAction(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = trimmed(formData.get("id"));
  const pathId = trimmed(formData.get("pathId"));
  const direction = trimmed(formData.get("direction"));
  if (!id || !pathId) redirect(`${PATHS}?invalid=missing_id`);

  await db.transaction(async (tx) => {
    const steps = await tx
      .select()
      .from(workflowPathSteps)
      .where(
        and(
          eq(workflowPathSteps.pathId, pathId),
          eq(workflowPathSteps.workspaceId, workspaceId),
        ),
      )
      .orderBy(asc(workflowPathSteps.position));
    const index = steps.findIndex((step) => step.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= steps.length) return;
    // Park one position out of range first: the (path, position) index is
    // unique, so a direct swap would collide.
    await tx
      .update(workflowPathSteps)
      .set({ position: 0 })
      .where(eq(workflowPathSteps.id, steps[index].id));
    await tx
      .update(workflowPathSteps)
      .set({ position: steps[index].position })
      .where(eq(workflowPathSteps.id, steps[target].id));
    await tx
      .update(workflowPathSteps)
      .set({ position: steps[target].position })
      .where(eq(workflowPathSteps.id, steps[index].id));
  });
  revalidatePath(`${PATHS}/${pathId}`);
  redirect(`${PATHS}/${pathId}?toast=path_saved`);
}

export async function addStepApproverAction(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const stepId = trimmed(formData.get("stepId"));
  const pathId = trimmed(formData.get("pathId"));
  const raw = trimmed(formData.get("approver"));
  if (!stepId || !pathId || !raw) redirect(`${PATHS}?invalid=required_fields`);

  // The picker encodes one option list as "kind:value".
  const [kind, value] = raw.split(":");
  if (!kind || !value) redirect(`${PATHS}/${pathId}?invalid=required_fields`);

  await db.insert(workflowPathStepApprovers).values({
    workspaceId,
    stepId,
    kind: kind as "user" | "team" | "role" | "dynamic",
    userId: kind === "user" ? value : null,
    teamId: kind === "team" ? value : null,
    role: kind === "role" ? value : null,
    dynamic: kind === "dynamic" ? value : null,
  });
  revalidatePath(`${PATHS}/${pathId}`);
  redirect(`${PATHS}/${pathId}?toast=path_saved`);
}

export async function removeStepApproverAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspaceRole("admin");
  const id = trimmed(formData.get("id"));
  const pathId = trimmed(formData.get("pathId"));
  if (!id || !pathId) redirect(`${PATHS}?invalid=missing_id`);
  await db
    .delete(workflowPathStepApprovers)
    .where(
      and(
        eq(workflowPathStepApprovers.id, id),
        eq(workflowPathStepApprovers.workspaceId, workspaceId),
      ),
    );
  revalidatePath(`${PATHS}/${pathId}`);
  redirect(`${PATHS}/${pathId}?toast=path_saved`);
}
