"use client";

import * as React from "react";
import { AssistantSidebarTrigger } from "@/components/assistant/assistant-trigger";
import { BrandLogo } from "@/components/brand-logo";
import { BuildMark } from "@/components/build-mark";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { NewInvoiceButton } from "@/components/new-invoice-button";
import { TokenBalanceChip } from "@/components/settings/token-balance-chip";
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
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import {
  ArchiveRestoreIcon,
  BookOpenIcon,
  Building2Icon,
  FileTextIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  RepeatIcon,
  SettingsIcon,
  ShieldIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceListItem } from "@/lib/auth/workspace-types";

/**
 * Five destinations and a create button, as before — the Automation, Tools and
 * Manage groups are not coming back. What changed is that the places those
 * groups used to hold are no longer reachable *only* from a dropdown: recurring
 * invoices, the importer and bank connections now hang off the section that
 * owns them, expanded when you are already in that section and out of the way
 * otherwise.
 *
 * Settings keep their two doors (the workspace switcher, the user menu) and gain
 * a third, explicit one. The doors were never the problem — an unlabelled menu
 * as the *only* route to workspace settings was.
 */
export function AppSidebar({
  user,
  isPlatformAdmin = false,
  activeWorkspaceId,
  defaultWorkspaceId,
  workspaces,
  tokenBalance = null,
  uploadConfigured = true,
  canSeePayments = true,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
  isPlatformAdmin?: boolean;
  activeWorkspaceId: string;
  defaultWorkspaceId: string | null;
  workspaces: WorkspaceListItem[];
  /**
   * Resolved from the permission catalog (ADR 0038). Hiding is in addition to
   * the server gate on `/payments`, never instead of it.
   */
  canSeePayments?: boolean;
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
      /** Open while anywhere under /invoices, so the siblings are one click away. */
      defaultOpen: pathname.startsWith("/invoices"),
      items: [
        {
          title: t("nav.invoicesRecurring"),
          url: "/invoices/recurring",
          icon: <RepeatIcon />,
          isActive: pathname.startsWith("/invoices/recurring"),
        },
        {
          title: t("nav.invoicesImport"),
          url: "/invoices/import",
          icon: <ArchiveRestoreIcon />,
          isActive: pathname.startsWith("/invoices/import"),
        },
      ],
    },
    ...(canSeePayments
      ? [
          {
            title: t("nav.payments"),
            url: "/payments",
            icon: <LandmarkIcon />,
            isActive:
              pathname === "/payments" || pathname.startsWith("/payments/"),
            defaultOpen:
              pathname.startsWith("/payments") ||
              pathname.startsWith("/settings/workspace/bank-connections"),
            items: [
              {
                /** Lives in workspace settings, but it is the payments feature's plumbing. */
                title: t("nav.bankConnections"),
                url: "/settings/workspace/bank-connections",
                icon: <LandmarkIcon />,
                isActive: pathname.startsWith(
                  "/settings/workspace/bank-connections",
                ),
              },
            ],
          },
        ]
      : []),
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
              render={<Link href="/dashboard" prefetch={false} />}
            >
              <BrandLogo
                className="group-data-[collapsible=icon]:hidden"
                priority
                size={22}
                variant="wordmark"
              />
              <BrandLogo
                className="hidden shadow-sm shadow-black/10 group-data-[collapsible=icon]:flex dark:shadow-black/40"
                priority
                size={32}
              />
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[0.7rem] text-muted-foreground">
                  {t("brand.tagline")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mx-2 hidden h-px bg-linear-to-r from-brand/25 via-brand/10 to-transparent group-data-[collapsible=icon]:hidden sm:block" />
        <WorkspaceSwitcher
          activeWorkspaceId={activeWorkspaceId}
          defaultWorkspaceId={defaultWorkspaceId}
          uploadConfigured={uploadConfigured}
          workspaces={workspaces}
        />
        <NewInvoiceButton pathname={pathname} />
        <AssistantSidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="pt-1">
        <NavMain
          collapseLabel={(title) => t("nav.collapseToggle", { title })}
          groupLabel={t("nav.group")}
          items={navMain}
        />
        <NavSecondary
          groupLabel={t("nav.settingsGroup")}
          items={[
            {
              title: t("nav.settingsWorkspace"),
              url: "/settings/workspace",
              icon: <SettingsIcon />,
              isActive: pathname.startsWith("/settings/workspace"),
            },
            {
              title: t("nav.settingsAccount"),
              url: "/settings/account",
              icon: <UserRoundIcon />,
              isActive: pathname.startsWith("/settings/account"),
            },
            ...(isPlatformAdmin
              ? [
                  {
                    title: t("nav.admin"),
                    url: "/admin",
                    icon: <ShieldIcon />,
                    isActive: pathname.startsWith("/admin"),
                  },
                ]
              : []),
          ]}
        />
        <NavSecondary
          className="mt-auto"
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
        <BuildMark />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
