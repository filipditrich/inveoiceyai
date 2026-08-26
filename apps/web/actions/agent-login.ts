"use server";

import { member, user, workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { eq } from "drizzle-orm";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";

const AGENT_EMAIL = "agent@invoicey.local";

export async function agentLoginAction(formData: FormData): Promise<void> {
  const configured = env.INVOICEY_AGENT_LOGIN_SECRET;
  if (!configured) {
    redirect("/agent-login?invalid=disabled");
  }
  const secret =
    typeof formData.get("secret") === "string" ? formData.get("secret") : "";
  if (secret !== configured) {
    redirect("/agent-login?invalid=bad_secret");
  }

  let [agent] = await db
    .select()
    .from(user)
    .where(eq(user.email, AGENT_EMAIL))
    .limit(1);
  if (!agent) {
    const id = `agent_${randomBytes(8).toString("hex")}`;
    const [created] = await db
      .insert(user)
      .values({
        id,
        name: "Invoicey Agent",
        email: AGENT_EMAIL,
        emailVerified: true,
      })
      .returning();
    agent = created!;
  }

  const [membership] = await db
    .select()
    .from(member)
    .where(eq(member.userId, agent.id))
    .limit(1);
  let workspaceId = membership?.organizationId ?? null;
  if (!workspaceId) {
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .limit(1);
    if (!workspace) {
      redirect("/agent-login?invalid=no_workspace");
    }
    workspaceId = workspace.id;
    await db.insert(member).values({
      id: `mem_${randomBytes(8).toString("hex")}`,
      organizationId: workspaceId,
      userId: agent.id,
      role: "owner",
    });
  }

  const authSecret = env.BETTER_AUTH_SECRET;
  if (!authSecret) {
    redirect("/agent-login?invalid=disabled");
  }
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createSession(agent.id, false, {
    userAgent: "invoicey-agent",
    activeOrganizationId: workspaceId,
  });
  const signature = createHmac("sha256", authSecret)
    .update(created.token)
    .digest("base64");
  const expiresAt =
    created.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const jar = await cookies();
  jar.set("better-auth.session_token", `${created.token}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
  redirect("/dashboard");
}
