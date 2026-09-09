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
import { appResourceLinks } from "@/lib/public-nav";
import {
  isInvoiceListPath,
  isInvoicesGroupPath,
  isPaymentsGroupPath,
} from "@/lib/section-nav";
import {
  ArchiveRestoreIcon,
  BookOpenIcon,
  BracesIcon,
  Building2Icon,
  FileDownIcon,
  FileTextIcon,
  FilesIcon,
  HouseIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  RepeatIcon,
  ScanLineIcon,
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
 * Five destinations and a create button. Each group keeps a parent link to its
 * home, repeats that home as the first child, and stays open so the siblings
 * are visible without an extra click.
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
  canRenderInvoices = false,
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
  canRenderInvoices?: boolean;
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
      isActive: isInvoicesGroupPath(pathname),
      /** Keep children visible — a closed group hides the invoices home. */
      defaultOpen: true,
      items: [
        {
          title: t("nav.invoicesMine"),
          url: "/invoices",
          icon: <FilesIcon />,
          isActive: isInvoiceListPath(pathname),
        },
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
        {
          title: t("nav.invoicesFromJson"),
          url: "/invoices/from-json",
          icon: <BracesIcon />,
          isActive: pathname.startsWith("/invoices/from-json"),
        },
        ...(canRenderInvoices
          ? [
              {
                title: t("nav.invoicesRender"),
                url: "/invoices/render",
                icon: <FileDownIcon />,
                isActive: pathname.startsWith("/invoices/render"),
              },
            ]
          : []),
      ],
    },
    ...(canSeePayments
      ? [
          {
            title: t("nav.payments"),
            url: "/payments",
            icon: <LandmarkIcon />,
            isActive: isPaymentsGroupPath(pathname),
            /** Keep children visible — a closed group hides matching and banks. */
            defaultOpen: true,
            items: [
              {
                title: t("nav.paymentsMatching"),
                url: "/payments",
                icon: <ListChecksIcon />,
                isActive: pathname === "/payments",
              },
              {
                title: t("nav.paymentRequests"),
                url: "/payments/requests",
                icon: <ScanLineIcon />,
                isActive: pathname.startsWith("/payments/requests"),
              },
              {
                title: t("nav.bankConnections"),
                url: "/payments/connections",
                icon: <LandmarkIcon />,
                isActive: pathname.startsWith("/payments/connections"),
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
        <NewInvoiceButton
          canRenderInvoices={canRenderInvoices}
          pathname={pathname}
        />
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
          items={appResourceLinks(pathname).map((item) => ({
            title: item.key === "home" ? t("nav.home") : t("nav.docs"),
            url: item.url,
            icon: item.key === "home" ? <HouseIcon /> : <BookOpenIcon />,
            isActive: item.isActive,
          }))}
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
