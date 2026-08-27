"use client";

import { BrandLogo } from "@/components/brand-logo";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { NewInvoiceButton } from "@/components/new-invoice-button";
import { TokenBalanceChip } from "@/components/settings/token-balance-chip";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { APP_GIT_SHA, APP_VERSION } from "@/lib/app-build-info";
import type { WorkspaceListItem } from "@/lib/auth/workspace-types";
import {
  BookOpenIcon,
  Building2Icon,
  FileTextIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

/**
 * Six destinations, one create button, two settings doors (the workspace
 * switcher and the user menu). Everything that used to sit in the Automation,
 * Tools, and Manage groups now hangs off whichever of those it belongs to.
 */
export function AppSidebar({
  user,
  isPlatformAdmin = false,
  activeWorkspaceId,
  defaultWorkspaceId,
  workspaces,
  tokenBalance = null,
  uploadConfigured = true,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
  isPlatformAdmin?: boolean;
  activeWorkspaceId: string;
  defaultWorkspaceId: string | null;
  workspaces: WorkspaceListItem[];
  tokenBalance?: {
    giftedRemaining: number;
    monthlyRemaining: number;
    purchasedRemaining: number;
    totalAvailable: number;
    monthlyLimit: number;
  } | null;
  uploadConfigured?: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("App");

  /** The create routes live under /invoices but belong to the create button. */
  const invoicesActive =
    pathname === "/invoices" ||
    (pathname.startsWith("/invoices/") &&
      !pathname.startsWith("/invoices/new") &&
      !pathname.startsWith("/invoices/ai") &&
      !pathname.startsWith("/invoices/from-json") &&
      !pathname.startsWith("/invoices/import") &&
      !pathname.startsWith("/invoices/recurring"));

  const navMain = [
    {
      title: t("nav.dashboard"),
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
      isActive: pathname === "/dashboard",
    },
    {
      title: t("nav.invoices"),
      url: "/invoices",
      icon: <FileTextIcon />,
      isActive: invoicesActive,
    },
    {
      title: t("nav.payments"),
      url: "/payments",
      icon: <LandmarkIcon />,
      isActive: pathname === "/payments" || pathname.startsWith("/payments/"),
    },
    {
      title: t("nav.clients"),
      url: "/clients",
      icon: <UsersIcon />,
      isActive: pathname === "/clients" || pathname.startsWith("/clients/"),
    },
    {
      title: t("nav.issuers"),
      url: "/issuers",
      icon: <Building2Icon />,
      isActive: pathname === "/issuers" || pathname.startsWith("/issuers/"),
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="gap-3 pb-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-sidebar-accent/70 data-[slot=sidebar-menu-button]:gap-3"
              render={<Link href="/dashboard" prefetch />}
            >
              <BrandLogo
                className="shadow-sm shadow-black/10 dark:shadow-black/40"
                priority
                size={32}
              />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold tracking-tight">
                  {t("meta.title")}
                </span>
                <span className="text-muted-foreground truncate text-[0.7rem]">
                  {t("brand.tagline")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="from-brand/25 via-brand/10 bg-linear-to-r mx-2 hidden h-px to-transparent group-data-[collapsible=icon]:hidden sm:block" />
        <WorkspaceSwitcher
          activeWorkspaceId={activeWorkspaceId}
          defaultWorkspaceId={defaultWorkspaceId}
          uploadConfigured={uploadConfigured}
          workspaces={workspaces}
        />
        <NewInvoiceButton pathname={pathname} />
      </SidebarHeader>
      <SidebarContent className="pt-1">
        <NavMain
          collapseLabel={(title) => t("nav.collapseToggle", { title })}
          groupLabel={t("nav.group")}
          items={navMain}
        />
        <NavSecondary
          groupLabel={t("nav.resourcesGroup")}
          items={[
            {
              title: t("nav.docs"),
              url: "/docs",
              icon: <BookOpenIcon />,
              isActive: pathname === "/docs" || pathname.startsWith("/docs/"),
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter className="gap-3">
        {tokenBalance ? (
          <div className="px-2">
            <TokenBalanceChip {...tokenBalance} />
          </div>
        ) : null}
        <NavUser isPlatformAdmin={isPlatformAdmin} user={user} />
        {process.env.NODE_ENV !== "production" ? (
          <p
            className="text-muted-foreground px-2 pb-1 font-mono text-[0.65rem] tabular-nums tracking-wide group-data-[collapsible=icon]:hidden"
            title={`${t("meta.title")} v${APP_VERSION} (${APP_GIT_SHA})`}
          >
            v{APP_VERSION}
            <span className="mx-1.5 opacity-40" aria-hidden>
              ·
            </span>
            {APP_GIT_SHA}
          </p>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
