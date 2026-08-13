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

import { AppShell } from "./app-shell";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Redirects signed-out users. Individual pages still call
  // `requireWorkspace()` themselves — a layout is not an authorization
  // boundary, since route handlers and actions do not pass through it.
  const [user, { workspaceId }] = await Promise.all([
    requireSession(),
    requireWorkspace(),
  ]);
  const [platformAdmin, workspaces, defaultWorkspaceId, tokenSummary] =
    await Promise.all([
      isPlatformAdmin(),
      listUserWorkspaces(user.id),
      getUserDefaultWorkspaceId(user.id),
      getWorkspaceTokenSummary(db, workspaceId).catch((error: unknown) => {
        /** schema may lag deploy — do not 500/404 the whole app shell */
        console.error("[app-shell] token summary unavailable", error);
        return null;
      }),
    ]);

  return (
    <AppShell
      activeWorkspaceId={workspaceId}
      defaultWorkspaceId={defaultWorkspaceId}
      isPlatformAdmin={platformAdmin}
      tokenBalance={
        tokenSummary
          ? {
              giftedRemaining: tokenSummary.giftedRemaining,
              monthlyRemaining: tokenSummary.monthlyRemaining,
              purchasedRemaining: tokenSummary.purchasedRemaining,
              totalAvailable: tokenSummary.totalAvailable,
            }
          : null
      }
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
