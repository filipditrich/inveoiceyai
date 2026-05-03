"use client";

import { NavDocuments } from "@/components/nav-documents";
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
	BookOpenIcon,
	BracesIcon,
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

const documentItems = [
	{
		name: "Invoices overview",
		url: "/invoices",
		icon: FileTextIcon,
	},
	{
		name: "From JSON",
		url: "/invoices/from-json",
		icon: BracesIcon,
	},
];

const navSecondaryItems = [
	{
		title: "Sidebar docs (shadcn)",
		url: "https://ui.shadcn.com/docs/components/sidebar",
		icon: <BookOpenIcon />,
	},
];

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
		<Sidebar collapsible="icon" variant="inset" {...props}>
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
				<NavDocuments items={documentItems} />
				<NavSecondary groupLabel="Links" items={navSecondaryItems} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={demoUser} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
