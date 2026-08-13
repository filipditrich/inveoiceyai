"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { NavigationPendingOverlay } from "@/components/navigation/navigation-progress";
import { SiteHeader } from "@/components/site-header";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { WorkspaceListItem } from "@/lib/auth/workspace-types";
import type { CSSProperties, ReactNode } from "react";

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
};

export function AppShell({
  children,
  user,
  isPlatformAdmin = false,
  activeWorkspaceId,
  defaultWorkspaceId,
  workspaces,
  tokenBalance,
}: Readonly<{
  children: ReactNode;
  user: AppShellUser;
  isPlatformAdmin?: boolean;
  activeWorkspaceId: string;
  defaultWorkspaceId: string | null;
  workspaces: WorkspaceListItem[];
  tokenBalance?: AppShellTokenBalance | null;
}>) {
  return (
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
        defaultWorkspaceId={defaultWorkspaceId}
        isPlatformAdmin={isPlatformAdmin}
        tokenBalance={tokenBalance}
        user={user}
        workspaces={workspaces}
      />
      <SidebarInset className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
        <SiteHeader />
        <ToastFromSearchParams />
        <div className="@container/main relative flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 md:gap-6 md:px-6 md:py-6 lg:px-10">
            {children}
          </div>
          <NavigationPendingOverlay />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
