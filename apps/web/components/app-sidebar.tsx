"use client";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	Building2Icon,
	FileTextIcon,
	LayoutDashboardIcon,
	ReceiptIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

const demoUser = {
	name: "Invoicey Demo",
	email: "demo@invoicey.demo",
	avatar: "",
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();

	const invoicesOpen =
		pathname === "/invoices" || pathname === "/invoices/from-json";

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
				{ title: "Overview", url: "/invoices" },
				{ title: "From JSON", url: "/invoices/from-json" },
			],
		},
		{
			title: "Clients",
			url: "/clients",
			icon: <UsersIcon />,
			isActive: pathname === "/clients",
		},
		{
			title: "Issuers",
			url: "/issuers",
			icon: <Building2Icon />,
			isActive: pathname === "/issuers",
		},
		{
			title: "Settings",
			url: "/settings",
			icon: <SettingsIcon />,
			isActive: pathname === "/settings",
		},
	];

	return (
		<Sidebar
			className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
			{...props}
		>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" render={<Link href="/dashboard" prefetch />}>
							<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
								<ReceiptIcon className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">Invoicey</span>
								<span className="truncate text-xs opacity-75">Demo shell</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={navMain} groupLabel="Navigate" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={demoUser} />
			</SidebarFooter>
		</Sidebar>
	);
}
