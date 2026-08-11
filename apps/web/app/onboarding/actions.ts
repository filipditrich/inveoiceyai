"use server";

import { createPersonalWorkspace } from "@/lib/auth/workspace-bootstrap";
import { getOptionalWorkspace, requireSession } from "@/lib/auth/session";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** Recovery path for an account whose first-sign-in bootstrap did not complete. */
export async function createFirstWorkspace(): Promise<void> {
  const user = await requireSession();

  // Idempotent: if a workspace appeared since the page rendered, use it.
  const existing = await getOptionalWorkspace();
  const workspaceId =
    existing?.workspaceId ??
    (await createPersonalWorkspace({
      id: user.id,
      name: user.name,
      email: user.email,
    }));

  await auth.api.setActiveOrganization({
    headers: await headers(),
    body: { organizationId: workspaceId },
  });

  redirect("/dashboard");
}
