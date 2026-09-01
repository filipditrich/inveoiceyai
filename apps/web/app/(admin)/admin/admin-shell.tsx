"use client";

import type { CSSProperties, ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminSiteHeader } from "@/components/admin/admin-site-header";
import { NavigationPendingOverlay } from "@/components/navigation/navigation-progress";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export interface AdminShellUser {
  name: string;
  email: string;
  avatar: string;
}

export function AdminShell({
  children,
  user,
}: Readonly<{ children: ReactNode; user: AdminShellUser }>) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as CSSProperties
      }
    >
      <AdminSidebar user={user} />
      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <AdminSiteHeader />
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
