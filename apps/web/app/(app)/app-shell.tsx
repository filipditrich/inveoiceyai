"use client";

import type { CSSProperties, ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AssistantProvider } from "@/components/assistant/assistant-provider";
import { NavigationPendingOverlay } from "@/components/navigation/navigation-progress";
import { BillingBanner } from "@/components/settings/billing-banner";
import { SiteHeader } from "@/components/site-header";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useTranslations } from "next-intl";

import type { WorkspaceListItem } from "@/lib/auth/workspace-types";

export interface AppShellUser {
  name: string;
  email: string;
  avatar: string;
}

export type AppShellTokenBalance = {
  giftedRemaining: number;
  monthlyRemaining: number;
  purchasedRemaining: number;
  totalAvailable: number;
  monthlyLimit: number;
  daysUntilRenewal: number;
};

export function AppShell({
  children,
  user,
  isPlatformAdmin = false,
  activeWorkspaceId,
  defaultWorkspaceId,
  workspaces,
  tokenBalance,
  uploadConfigured = true,
  canSeePayments = true,
  frozenReason = null,
  billingAlert = null,
}: Readonly<{
  children: ReactNode;
  user: AppShellUser;
  isPlatformAdmin?: boolean;
  activeWorkspaceId: string;
  defaultWorkspaceId: string | null;
  workspaces: WorkspaceListItem[];
  tokenBalance?: AppShellTokenBalance | null;
  uploadConfigured?: boolean;
  canSeePayments?: boolean;
  frozenReason?: string | null;
  billingAlert?: { pastDue: boolean; canceling: boolean } | null;
}>) {
  const t = useTranslations("App.freeze");
  return (
    <AssistantProvider
      initialBalance={tokenBalance ?? null}
      workspaceId={activeWorkspaceId}
    >
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 14)",
          } as CSSProperties
        }
      >
        <AppSidebar
          activeWorkspaceId={activeWorkspaceId}
          canSeePayments={canSeePayments}
          defaultWorkspaceId={defaultWorkspaceId}
          isPlatformAdmin={isPlatformAdmin}
          tokenBalance={tokenBalance}
          uploadConfigured={uploadConfigured}
          user={user}
          workspaces={workspaces}
        />
        {/* `overflow-clip` keeps the inset's rounded corners without making this a
            scroll container — `overflow-hidden` here silently killed every
            `position: sticky` inside the app, header and form bars included. */}
        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-clip bg-background">
          <SiteHeader />
          <ToastFromSearchParams />
          {frozenReason !== null ? (
            <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm md:px-6 lg:px-10">
              <p className="font-medium text-destructive">{t("banner")}</p>
              {frozenReason ? (
                <p className="mt-1 text-muted-foreground">
                  {t("reason", { reason: frozenReason })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="@container/main relative flex min-w-0 flex-1 flex-col gap-2">
            <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 md:gap-6 md:px-6 md:py-6 lg:px-10">
              {billingAlert ? (
                <BillingBanner
                  canceling={billingAlert.canceling}
                  pastDue={billingAlert.pastDue}
                />
              ) : null}
              {children}
            </div>
            <NavigationPendingOverlay />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AssistantProvider>
  );
}
