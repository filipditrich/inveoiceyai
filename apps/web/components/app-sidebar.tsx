"use client";

import { NavDocuments } from "@/components/nav-documents";
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
	SidebarRail,
} from "@/components/ui/sidebar";
import {
	BracesIcon,
	Building2Icon,
	FilePlusIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	ReceiptIcon,
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
		name: "New invoice",
		url: "/invoices/new",
		icon: FilePlusIcon,
	},
	{
		name: "From JSON",
		url: "/invoices/from-json",
		icon: BracesIcon,
	},
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();

	const invoicesOpen =
		pathname === "/invoices" ||
		pathname.startsWith("/invoices/");

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
				{ title: "New", url: "/invoices/new" },
				{ title: "From JSON", url: "/invoices/from-json" },
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
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							render={<Link href="/dashboard" prefetch />}
						>
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
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={demoUser} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
