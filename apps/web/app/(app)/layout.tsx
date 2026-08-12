import {
  isIssuerWelcomeGatePath,
  shouldGateIssuerWelcome,
} from "@/lib/issuer-welcome";
import {
  isPlatformAdmin,
  requireSession,
  requireWorkspace,
} from "@/lib/auth/session";
import {
  getUserDefaultWorkspaceId,
  listUserWorkspaces,
} from "@/lib/auth/workspaces";
import { getWorkspaceTokenSummary } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "./app-shell";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Redirects signed-out users. Individual pages still call
  // `requireWorkspace()` themselves — a layout is not an authorization
  // boundary, since route handlers and actions do not pass through it.
  const user = await requireSession();
  const { workspaceId } = await requireWorkspace();
  const [platformAdmin, workspaces, defaultWorkspaceId, tokenSummary] =
    await Promise.all([
      isPlatformAdmin(),
      listUserWorkspaces(user.id),
      getUserDefaultWorkspaceId(user.id),
      getWorkspaceTokenSummary(db, workspaceId),
    ]);

  const pathname = (await headers()).get("x-pathname") ?? "";
  if (
    isIssuerWelcomeGatePath(pathname) &&
    (await shouldGateIssuerWelcome(workspaceId))
  ) {
    redirect("/welcome");
  }

  return (
    <AppShell
      activeWorkspaceId={workspaceId}
      defaultWorkspaceId={defaultWorkspaceId}
      isPlatformAdmin={platformAdmin}
      tokenBalance={{
        giftedRemaining: tokenSummary.giftedRemaining,
        monthlyRemaining: tokenSummary.monthlyRemaining,
        purchasedRemaining: tokenSummary.purchasedRemaining,
        totalAvailable: tokenSummary.totalAvailable,
      }}
      user={{
        name: user.name,
        email: user.email,
        avatar: user.image ?? "",
      }}
      workspaces={workspaces}
    >
      {children}
    </AppShell>
  );
}
