"use client";

import { BrandLogo } from "@/components/brand-logo";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
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
  ArchiveRestoreIcon,
  BookOpenIcon,
  BracesIcon,
  Building2Icon,
  FilePlus2Icon,
  FileTextIcon,
  ListIcon,
  LayoutDashboardIcon,
  LandmarkIcon,
  PlugZapIcon,
  PlusIcon,
  RepeatIcon,
  Settings2Icon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export function AppSidebar({
  user,
  isPlatformAdmin = false,
  activeWorkspaceId,
  defaultWorkspaceId,
  workspaces,
  tokenBalance = null,
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
  } | null;
}) {
  const pathname = usePathname();
  const t = useTranslations("App");

  const invoicesOpen =
    pathname === "/invoices" || pathname.startsWith("/invoices/");

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
      isActive: invoicesOpen,
      defaultOpen: true,
      items: [
        {
          title: t("nav.invoicesList"),
          url: "/invoices",
          icon: <ListIcon />,
          isActive:
            pathname === "/invoices" ||
            (pathname.startsWith("/invoices/") &&
              !pathname.startsWith("/invoices/new") &&
              !pathname.startsWith("/invoices/ai") &&
              !pathname.startsWith("/invoices/from-json") &&
              !pathname.startsWith("/invoices/import") &&
              !pathname.startsWith("/invoices/recurring")),
        },
        {
          title: t("nav.invoicesNew"),
          url: "/invoices/new",
          icon: <FilePlus2Icon />,
          isActive: pathname === "/invoices/new",
        },
        {
          title: t("nav.invoicesAi"),
          url: "/invoices/ai",
          icon: <SparklesIcon />,
          isActive: pathname === "/invoices/ai",
        },
        {
          title: t("nav.invoicesRecurring"),
          url: "/invoices/recurring",
          icon: <RepeatIcon />,
          isActive: pathname === "/invoices/recurring",
        },
        {
          title: t("nav.invoicesImport"),
          url: "/invoices/import",
          icon: <ArchiveRestoreIcon />,
          isActive: pathname === "/invoices/import",
        },
        {
          title: t("nav.invoicesFromJson"),
          url: "/invoices/from-json",
          icon: <BracesIcon />,
          isActive: pathname === "/invoices/from-json",
        },
      ],
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
          workspaces={workspaces}
        />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground shadow-xs"
              isActive={pathname === "/invoices/new"}
              render={<Link href="/invoices/new" prefetch />}
              tooltip={t("nav.newInvoice")}
            >
              <PlusIcon className="size-4" />
              <span className="font-medium">{t("nav.newInvoice")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="pt-1">
        <NavMain
          collapseLabel={(title) => t("nav.collapseToggle", { title })}
          groupLabel={t("nav.group")}
          items={navMain}
        />
        <NavSecondary
          groupLabel={t("nav.manageGroup")}
          items={[
            {
              title: t("nav.settings"),
              url: "/settings",
              icon: <Settings2Icon />,
              isActive:
                (pathname === "/settings" ||
                  pathname.startsWith("/settings/")) &&
                pathname !== "/settings/integrations",
            },
            {
              title: t("nav.integrations"),
              url: "/settings/integrations",
              icon: <PlugZapIcon />,
              isActive: pathname === "/settings/integrations",
            },
          ]}
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
          <div className="px-2 group-data-[collapsible=icon]:hidden">
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
