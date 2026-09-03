import {
  isPlatformAdmin,
  requireSession,
  requireWorkspace,
} from "@/lib/auth/session";
import {
  getUserDefaultWorkspaceId,
  listUserWorkspaces,
} from "@/lib/auth/workspaces";
import { can } from "@/lib/authz/can";

import {
  getWorkspaceBillingState,
  getWorkspaceFreeze,
  getWorkspaceTokenSummary,
  isFrozen,
} from "@invoicey/db";
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
  const [
    platformAdmin,
    workspaces,
    defaultWorkspaceId,
    tokenSummary,
    canSeePayments,
    freeze,
    billingState,
  ] = await Promise.all([
    isPlatformAdmin(),
    listUserWorkspaces(user.id),
    getUserDefaultWorkspaceId(user.id),
    getWorkspaceTokenSummary(db, workspaceId).catch((error: unknown) => {
      /** schema may lag deploy — do not 500/404 the whole app shell */
      console.error("[app-shell] token summary unavailable", error);
      return null;
    }),
    // Hides the payments nav for a member without the permission. The route
    // itself is gated too — this only avoids offering a dead end (ADR 0038).
    can("payments:read").catch(() => false),
    getWorkspaceFreeze(db, workspaceId).catch((error: unknown) => {
      console.error("[app-shell] freeze state unavailable", error);
      return null;
    }),
    getWorkspaceBillingState(db, workspaceId).catch((error: unknown) => {
      console.error("[app-shell] billing state unavailable", error);
      return null;
    }),
  ]);

  return (
    <AppShell
      activeWorkspaceId={workspaceId}
      billingAlert={
        billingState
          ? { pastDue: billingState.pastDue, canceling: billingState.canceling }
          : null
      }
      canSeePayments={canSeePayments}
      defaultWorkspaceId={defaultWorkspaceId}
      frozenReason={
        isFrozen(freeze?.frozenAt) ? (freeze?.freezeReason ?? "") : null
      }
      isPlatformAdmin={platformAdmin}
      tokenBalance={
        tokenSummary
          ? {
              giftedRemaining: tokenSummary.giftedRemaining,
              monthlyRemaining: tokenSummary.monthlyRemaining,
              purchasedRemaining: tokenSummary.purchasedRemaining,
              totalAvailable: tokenSummary.totalAvailable,
              monthlyLimit: tokenSummary.monthlyLimit,
              daysUntilRenewal: tokenSummary.daysUntilRenewal,
            }
          : null
      }
      uploadConfigured={Boolean(process.env.UPLOADTHING_TOKEN?.trim())}
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
