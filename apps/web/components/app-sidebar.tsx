"use client";

import { BrandLogo } from "@/components/brand-logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ThemeModeSwitcher } from "@/components/theme-toggle";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import {
	Building2Icon,
	FileTextIcon,
	LayoutDashboardIcon,
	UsersIcon,
} from "lucide-react";
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

	const invoicesOpen =
		pathname === "/invoices" || pathname.startsWith("/invoices/");

	const navMain = [
		{
			title: "Dashboard",
			url: "/dashboard",
			icon: <LayoutDashboardIcon />,
			isActive: pathname === "/dashboard",
		},
		{
			title: "Invoices",
			url: "/invoices",
			icon: <FileTextIcon />,
			isActive: invoicesOpen,
			items: [
				{
					title: "Overview",
					url: "/invoices",
					isActive:
						pathname === "/invoices" ||
						(pathname.startsWith("/invoices/") &&
							!pathname.startsWith("/invoices/new") &&
							!pathname.startsWith("/invoices/from-json") &&
							!pathname.startsWith("/invoices/import")),
				},
				{
					title: "New",
					url: "/invoices/new",
					isActive: pathname === "/invoices/new",
				},
				{
					title: "Import",
					url: "/invoices/import",
					isActive: pathname === "/invoices/import",
				},
				{
					title: "From JSON",
					url: "/invoices/from-json",
					isActive: pathname === "/invoices/from-json",
				},
			],
		},
		{
			title: "Clients",
			url: "/clients",
			icon: <UsersIcon />,
			isActive: pathname === "/clients" || pathname.startsWith("/clients/"),
		},
		{
			title: "Issuers",
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
									Invoicey
								</span>
								<span className="text-muted-foreground truncate text-[0.7rem]">
									Czech invoicing
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<div className="from-brand/25 via-brand/10 mx-2 hidden h-px bg-linear-to-r to-transparent group-data-[collapsible=icon]:hidden sm:block" />
			</SidebarHeader>
			<SidebarContent className="pt-1">
				<NavMain items={navMain} groupLabel="Navigate" />
			</SidebarContent>
			<SidebarFooter className="gap-3">
				<SidebarGroup className="group-data-[collapsible=icon]:hidden p-0">
					<SidebarGroupLabel className="px-2">Appearance</SidebarGroupLabel>
					<ThemeModeSwitcher className="mx-1" />
				</SidebarGroup>
				<SidebarSeparator className="group-data-[collapsible=icon]:hidden mx-0" />
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
