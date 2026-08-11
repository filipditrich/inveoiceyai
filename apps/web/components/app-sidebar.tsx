"use client";

import { BrandLogo } from "@/components/brand-logo";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
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
import {
  BookOpenIcon,
  Building2Icon,
  FileTextIcon,
  LayoutDashboardIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
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
      items: [
        {
          title: t("nav.invoicesList"),
          url: "/invoices",
          isActive:
            pathname === "/invoices" ||
            (pathname.startsWith("/invoices/") &&
              !pathname.startsWith("/invoices/new") &&
              !pathname.startsWith("/invoices/from-json") &&
              !pathname.startsWith("/invoices/import")),
        },
        {
          title: t("nav.invoicesNew"),
          url: "/invoices/new",
          isActive: pathname === "/invoices/new",
        },
        {
          title: t("nav.invoicesImport"),
          url: "/invoices/import",
          isActive: pathname === "/invoices/import",
        },
        {
          title: t("nav.invoicesFromJson"),
          url: "/invoices/from-json",
          isActive: pathname === "/invoices/from-json",
        },
      ],
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
      </SidebarHeader>
      <SidebarContent className="pt-1">
        <NavMain items={navMain} groupLabel={t("nav.group")} />
        <NavSecondary
          className="mt-auto"
          groupLabel={t("nav.resourcesGroup")}
          items={[
            {
              title: t("nav.docs"),
              url: "/docs",
              icon: <BookOpenIcon />,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter className="gap-3">
        <NavUser user={user} />
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
