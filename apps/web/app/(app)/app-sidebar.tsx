"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Code2,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
	href: string;
	label: string;
	icon: LucideIcon;
	/** if true, only exact pathname match counts as active */
	end?: boolean;
};

const overviewItems: NavItem[] = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
];

const invoiceItems: NavItem[] = [
	{ href: "/invoices", label: "Invoices", icon: FileText, end: true },
	{ href: "/invoices/from-json", label: "Invoice from JSON", icon: Code2, end: true },
];

const workspaceItems: NavItem[] = [
	{ href: "/clients", label: "Clients", icon: Users },
	{ href: "/issuers", label: "Issuers", icon: Building2 },
	{ href: "/settings", label: "Settings", icon: Settings, end: true },
];

function isActive(pathname: string, item: NavItem): boolean {
	if (item.end === true) {
		return pathname === item.href;
	}
	return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarSection({
	title,
	items,
	pathname,
}: Readonly<{ title: string; items: NavItem[]; pathname: string }>) {
	return (
		<div className="mt-8 first:mt-0">
			<p className="text-sidebar-foreground/50 mb-2 px-3 text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
				{title}
			</p>
			<ul className="flex flex-col gap-0.5">
				{items.map((item) => {
					const Icon = item.icon;
					const active = isActive(pathname, item);
					return (
						<li key={item.href}>
							<Link
								href={item.href}
								className={cn(
									"group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
									active
										? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
										: "text-sidebar-foreground/85 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
								)}
							>
								<Icon
									className={cn(
										"size-4.5 shrink-0 opacity-70 transition-opacity group-hover:opacity-100",
										active && "text-sidebar-primary opacity-100",
									)}
									aria-hidden
								/>
								{item.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function AppSidebar() {
	const pathname = usePathname() ?? "";

	return (
		<aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex w-62 shrink-0 flex-col border-r">
			<div className="border-sidebar-border/80 flex flex-col gap-1 border-b px-5 py-6">
				<Link href="/dashboard" className="group outline-none transition-opacity hover:opacity-90">
					<span className="text-foreground text-[1.15rem] font-semibold tracking-tight">
						Invoicey
					</span>
				</Link>
				<p className="text-muted-foreground text-xs leading-relaxed">
					Local demo shell — Phase 3 PDF / JSON playground.
				</p>
			</div>

			<nav className="flex-1 overflow-y-auto px-4 py-5">
				<SidebarSection title="Overview" items={overviewItems} pathname={pathname} />
				<SidebarSection title="Invoices" items={invoiceItems} pathname={pathname} />
				<SidebarSection title="Workspace" items={workspaceItems} pathname={pathname} />
			</nav>

			<div className="border-sidebar-border/80 mt-auto border-t px-5 py-4">
				<p className="text-muted-foreground text-[0.6875rem] leading-snug">
					<code className="text-sidebar-foreground/70 bg-sidebar-accent rounded px-1.5 py-0.5 font-mono">
						bun dev
					</code>
					<span className="ml-2">runs this app.</span>
				</p>
			</div>
		</aside>
	);
}
