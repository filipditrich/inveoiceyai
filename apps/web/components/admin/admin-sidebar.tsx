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
import {
  Building2Icon,
  FileTextIcon,
  LayoutDashboardIcon,
  ShieldIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

export function AdminSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar: string };
}) {
  const pathname = usePathname();
  const t = useTranslations("Admin");

  const navMain = [
    {
      title: t("nav.dashboard"),
      url: "/admin",
      icon: <LayoutDashboardIcon />,
      isActive: pathname === "/admin",
    },
    {
      title: t("nav.users"),
      url: "/admin/users",
      icon: <UsersIcon />,
      isActive: pathname.startsWith("/admin/users"),
    },
    {
      title: t("nav.workspaces"),
      url: "/admin/workspaces",
      icon: <WarehouseIcon />,
      isActive: pathname.startsWith("/admin/workspaces"),
    },
    {
      title: t("nav.invoices"),
      url: "/admin/invoices",
      icon: <FileTextIcon />,
      isActive: pathname.startsWith("/admin/invoices"),
    },
    {
      title: t("nav.issuers"),
      url: "/admin/issuers",
      icon: <Building2Icon />,
      isActive: pathname.startsWith("/admin/issuers"),
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
              render={<Link href="/admin" prefetch />}
            >
              <BrandLogo
                className="shadow-sm shadow-black/10 dark:shadow-black/40"
                priority
                size={32}
              />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold tracking-tight">
                  {t("brand.title")}
                </span>
                <span className="text-muted-foreground truncate text-[0.7rem]">
                  {t("brand.tagline")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="from-brand/25 via-brand/10 bg-linear-to-r mx-2 hidden h-px to-transparent group-data-[collapsible=icon]:hidden sm:block" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground shadow-xs"
              render={<Link href="/dashboard" prefetch />}
              tooltip={t("nav.backToApp")}
            >
              <ShieldIcon className="size-4" />
              <span className="font-medium">{t("nav.backToApp")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="pt-1">
        <NavMain items={navMain} groupLabel={t("nav.group")} />
        <NavSecondary
          groupLabel={t("nav.productGroup")}
          items={[
            {
              title: t("nav.productDashboard"),
              url: "/dashboard",
              icon: <LayoutDashboardIcon />,
              isActive: false,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter className="gap-3">
        <NavUser isPlatformAdmin user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
